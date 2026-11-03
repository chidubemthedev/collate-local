/**
 * Scrapes the INEC polling unit locator (https://cvr.inecnigeria.org/pu) into
 * local JSON files under data/inec/. It never touches the database.
 *
 * Hierarchy: state -> local government -> registration area (ward) -> polling unit.
 * Each stage is saved as it completes, so a re-run resumes where it stopped.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const BASE_URL = "https://cvr.inecnigeria.org";
const OUT_DIR = join(process.cwd(), "data", "inec");
const CONCURRENCY = 4;
const REQUEST_DELAY_MS = 150;
const MAX_ATTEMPTS = 5;
const HEADERS = { "User-Agent": "Mozilla/5.0 (collate data import)" };

interface Row {
  internalId: number;
  code: string;
  name: string;
}
interface Lga extends Row {
  stateInternalId: number;
}
interface Ward extends Row {
  lgaInternalId: number;
}
interface PollingUnit extends Row {
  wardInternalId: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseLabel(internalId: number, label: string): Row {
  const separator = label.indexOf(" - ");
  if (separator === -1) {
    throw new Error(`Unexpected label format: ${label}`);
  }
  return {
    internalId,
    code: label.slice(0, separator).trim(),
    name: label.slice(separator + 3).trim(),
  };
}

async function getText(url: string): Promise<string> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, { headers: HEADERS });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) {
        throw new Error(`Failed after ${MAX_ATTEMPTS} attempts: ${url} (${String(error)})`);
      }
      await sleep(1000 * attempt);
    }
  }
}

async function fetchChildren(endpoint: string, parentField: string, parentId: number): Promise<Row[]> {
  const query = new URLSearchParams({ [`data[Search][${parentField}]`]: String(parentId) });
  const text = await getText(`${BASE_URL}/PublicApi/${endpoint}/1/Search?${query}`);
  const parsed = JSON.parse(text) as Array<Record<string, string>>;
  const options = parsed[0] ?? {};
  return Object.entries(options)
    .filter(([key]) => key !== "0" && key !== "selected")
    .map(([key, label]) => parseLabel(Number(key), label));
}

async function mapPool<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
      done += 1;
      if (done % 250 === 0 || done === items.length) {
        console.log(`  ${done}/${items.length}`);
      }
      await sleep(REQUEST_DELAY_MS);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, run));
  return results;
}

async function loadStage<T>(file: string): Promise<T[] | null> {
  try {
    return JSON.parse(await readFile(join(OUT_DIR, file), "utf8")) as T[];
  } catch {
    return null;
  }
}

async function saveStage(file: string, rows: unknown[]): Promise<void> {
  await writeFile(join(OUT_DIR, file), JSON.stringify(rows));
}

// Nested, compressed copy of the data. This is the only file that is committed
// and the one read by the seed script (lib/db/seeds/inec.ts).
async function packGeography(
  states: Row[],
  lgas: Lga[],
  wards: Ward[],
  pollingUnits: PollingUnit[],
): Promise<void> {
  const pollingUnitsByWard = new Map<number, Array<[string, string]>>();
  for (const unit of pollingUnits) {
    const list = pollingUnitsByWard.get(unit.wardInternalId) ?? [];
    list.push([unit.code, unit.name]);
    pollingUnitsByWard.set(unit.wardInternalId, list);
  }

  const seenWards = new Set<string>();
  const wardsByLga = new Map<number, Array<{ code: string; name: string; pollingUnits: Array<[string, string]> }>>();
  for (const ward of wards) {
    const key = `${ward.lgaInternalId}/${ward.code}`;
    const units = pollingUnitsByWard.get(ward.internalId);
    // INEC lists one ward twice (Benue, Gwer East); the copy has no polling units.
    if (seenWards.has(key) || !units) {
      continue;
    }
    seenWards.add(key);
    const list = wardsByLga.get(ward.lgaInternalId) ?? [];
    list.push({ code: ward.code, name: ward.name, pollingUnits: units });
    wardsByLga.set(ward.lgaInternalId, list);
  }

  const lgasByState = new Map<number, Array<{ code: string; name: string; wards: unknown[] }>>();
  for (const lga of lgas) {
    const list = lgasByState.get(lga.stateInternalId) ?? [];
    list.push({ code: lga.code, name: lga.name, wards: wardsByLga.get(lga.internalId) ?? [] });
    lgasByState.set(lga.stateInternalId, list);
  }

  const nested = states.map((state) => ({
    code: state.code,
    name: state.name,
    lgas: lgasByState.get(state.internalId) ?? [],
  }));
  await writeFile(join(OUT_DIR, "geography.json.gz"), gzipSync(JSON.stringify(nested), { level: 9 }));
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  let states = await loadStage<Row>("states.json");
  if (!states) {
    console.log("Fetching states");
    const html = await getText(`${BASE_URL}/pu`);
    states = [...html.matchAll(/<option value="(\d+)">([^<]+)<\/option>/g)]
      .filter((match) => match[2].includes(" - "))
      .map((match) => parseLabel(Number(match[1]), match[2]));
    await saveStage("states.json", states);
  }
  console.log(`states: ${states.length}`);

  let lgas = await loadStage<Lga>("lgas.json");
  if (!lgas) {
    console.log("Fetching LGAs");
    const perState = await mapPool(states, async (state) =>
      (await fetchChildren("lgas", "state_id", state.internalId)).map((row) => ({
        ...row,
        stateInternalId: state.internalId,
      })),
    );
    lgas = perState.flat();
    await saveStage("lgas.json", lgas);
  }
  console.log(`lgas: ${lgas.length}`);

  let wards = await loadStage<Ward>("wards.json");
  if (!wards) {
    console.log("Fetching wards");
    const perLga = await mapPool(lgas, async (lga) =>
      (await fetchChildren("wards", "local_government_id", lga.internalId)).map((row) => ({
        ...row,
        lgaInternalId: lga.internalId,
      })),
    );
    wards = perLga.flat();
    await saveStage("wards.json", wards);
  }
  console.log(`wards: ${wards.length}`);

  let pollingUnits = await loadStage<PollingUnit>("polling-units.json");
  if (!pollingUnits) {
    console.log("Fetching polling units");
    const perWard = await mapPool(wards, async (ward) =>
      (await fetchChildren("pus", "registration_area_id", ward.internalId)).map((row) => ({
        ...row,
        wardInternalId: ward.internalId,
      })),
    );
    pollingUnits = perWard.flat();
    await saveStage("polling-units.json", pollingUnits);
  }
  console.log(`polling units: ${pollingUnits.length}`);

  await packGeography(states, lgas, wards, pollingUnits);
  console.log("wrote data/inec/geography.json.gz");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
