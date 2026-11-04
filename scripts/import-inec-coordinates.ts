import dataSource from "../lib/db/data-source";
import {
  makePollingUnitKey,
  parseCoordinateCsv,
  parseCoordinatePair,
} from "../lib/db/seeds/inec-coordinates";

const SOURCE_URL =
  "https://raw.githubusercontent.com/mykeels/inec-polling-units/cea8b041d1c20819b1a63d0563a83908b8cd4e21/polling-units.csv";
const BATCH_SIZE = 2000;

interface DatabasePollingUnit {
  id: number;
  stateName: string;
  lgaName: string;
  wardName: string;
  pollingUnitName: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface CoordinateUpdate {
  id: number;
  latitude: number;
  longitude: number;
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function downloadSource(): Promise<string> {
  const response = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "Collate polling-unit coordinate import" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`Coordinate source returned HTTP ${response.status}.`);
  }
  return response.text();
}

async function loadPollingUnits(): Promise<DatabasePollingUnit[]> {
  return dataSource.query(`
    SELECT
      pu.id,
      s.state_name AS "stateName",
      l.lga_name AS "lgaName",
      w.ward_name AS "wardName",
      pu.polling_unit_name AS "pollingUnitName",
      pu.latitude,
      pu.longitude
    FROM polling_unit pu
    JOIN ward w ON w.id = pu.ward_id
    JOIN lga l ON l.id = w.lga_id
    JOIN state s ON s.id = l.state_id;
  `);
}

async function updateCoordinates(updates: CoordinateUpdate[]): Promise<number> {
  let updated = 0;
  await dataSource.transaction(async (manager) => {
    for (const batch of chunks(updates, BATCH_SIZE)) {
      const [rows] = (await manager.query(
        `
          UPDATE polling_unit AS pu
          SET latitude = input.latitude, longitude = input.longitude
          FROM unnest($1::int[], $2::double precision[], $3::double precision[])
            AS input(id, latitude, longitude)
          WHERE pu.id = input.id
            AND pu.latitude IS NULL
            AND pu.longitude IS NULL
          RETURNING pu.id;
        `,
        [
          batch.map((row) => row.id),
          batch.map((row) => row.latitude),
          batch.map((row) => row.longitude),
        ],
      )) as [Array<{ id: number }>, number];
      updated += rows.length;
    }
  });
  return updated;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply")) {
    throw new Error("Use no arguments for a dry run, or pass --apply to write coordinates.");
  }
  const apply = args.includes("--apply");
  const sourceRows = parseCoordinateCsv(await downloadSource());
  const sourceByKey = new Map<string, typeof sourceRows>();
  const coordinateCounts = { valid: 0, missing: 0, invalid: 0, outsideBounds: 0 };

  for (const row of sourceRows) {
    const coordinate = parseCoordinatePair(row.latitude, row.longitude);
    if (coordinate.valid) coordinateCounts.valid += 1;
    else if (coordinate.reason === "missing") coordinateCounts.missing += 1;
    else if (coordinate.reason === "outside_bounds") coordinateCounts.outsideBounds += 1;
    else coordinateCounts.invalid += 1;

    const key = makePollingUnitKey([row.stateName, row.lgaName, row.wardName, row.name]);
    if (key.split("\u001f").some((part) => !part)) continue;
    const matches = sourceByKey.get(key) ?? [];
    matches.push(row);
    sourceByKey.set(key, matches);
  }

  await dataSource.initialize();
  try {
    const databaseRows = await loadPollingUnits();
    const databaseByKey = new Map<string, DatabasePollingUnit[]>();
    for (const row of databaseRows) {
      if (!row.pollingUnitName) continue;
      const key = makePollingUnitKey([
        row.stateName,
        row.lgaName,
        row.wardName,
        row.pollingUnitName,
      ]);
      const matches = databaseByKey.get(key) ?? [];
      matches.push(row);
      databaseByKey.set(key, matches);
    }

    const updates: CoordinateUpdate[] = [];
    let duplicateSourceKeys = 0;
    let unmatchedSourceKeys = 0;
    let ambiguousDatabaseKeys = 0;
    let alreadyHasCoordinates = 0;

    for (const [key, rows] of sourceByKey) {
      if (rows.length !== 1) {
        duplicateSourceKeys += 1;
        continue;
      }

      const coordinate = parseCoordinatePair(rows[0].latitude, rows[0].longitude);
      if (!coordinate.valid) continue;

      const matches = databaseByKey.get(key);
      if (!matches) {
        unmatchedSourceKeys += 1;
        continue;
      }
      if (matches.length !== 1) {
        ambiguousDatabaseKeys += 1;
        continue;
      }
      if (matches[0].latitude !== null || matches[0].longitude !== null) {
        alreadyHasCoordinates += 1;
        continue;
      }
      updates.push({ id: matches[0].id, ...coordinate });
    }

    console.log(`Source rows: ${sourceRows.length}`);
    console.log(`Valid coordinate pairs within the coarse Nigeria envelope: ${coordinateCounts.valid}`);
    console.log(`Missing coordinate pairs: ${coordinateCounts.missing}`);
    console.log(`Malformed coordinate pairs: ${coordinateCounts.invalid}`);
    console.log(`Pairs outside the coarse envelope: ${coordinateCounts.outsideBounds}`);
    console.log(`Unique safe exact matches with empty database coordinates: ${updates.length}`);
    console.log(`Skipped duplicate source keys: ${duplicateSourceKeys}`);
    console.log(`Skipped ambiguous database keys: ${ambiguousDatabaseKeys}`);
    console.log(`Unmatched source keys: ${unmatchedSourceKeys}`);
    console.log(`Matched rows already holding coordinates: ${alreadyHasCoordinates}`);

    if (!apply) {
      console.log("Dry run only; no database rows were changed. Pass --apply to import.");
      return;
    }

    const updated = await updateCoordinates(updates);
    console.log(`Coordinates added: ${updated}`);
    console.log(`Not updated because another process filled coordinates: ${updates.length - updated}`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
