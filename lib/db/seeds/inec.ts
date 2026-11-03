import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { EntityManager } from "typeorm";
import dataSource from "../data-source";

interface PackedWard {
  code: string;
  name: string;
  pollingUnits: Array<[string, string]>;
}
interface PackedLga {
  code: string;
  name: string;
  wards: PackedWard[];
}
interface PackedState {
  code: string;
  name: string;
  lgas: PackedLga[];
}

const DATA_FILE = join(process.cwd(), "data", "inec", "geography.json.gz");
const BATCH_SIZE = 5000;

function loadGeography(): PackedState[] {
  return JSON.parse(gunzipSync(readFileSync(DATA_FILE)).toString("utf8")) as PackedState[];
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function upsertStates(manager: EntityManager, states: PackedState[]): Promise<Map<string, number>> {
  const rows = (await manager.query(
    `
      INSERT INTO state (inec_state_code, state_name)
      SELECT * FROM unnest($1::text[], $2::text[])
      ON CONFLICT (inec_state_code) DO UPDATE SET state_name = EXCLUDED.state_name
      RETURNING id, inec_state_code;
    `,
    [states.map((state) => state.code), states.map((state) => state.name)],
  )) as Array<{ id: number; inec_state_code: string }>;
  return new Map(rows.map((row) => [row.inec_state_code, row.id]));
}

async function upsertLgas(
  manager: EntityManager,
  states: PackedState[],
  stateIds: Map<string, number>,
): Promise<Map<string, number>> {
  const lgas = states.flatMap((state) =>
    state.lgas.map((lga) => ({ stateId: stateIds.get(state.code) as number, code: lga.code, name: lga.name })),
  );
  const ids = new Map<string, number>();
  for (const batch of chunk(lgas, BATCH_SIZE)) {
    const rows = (await manager.query(
      `
        INSERT INTO lga (state_id, inec_lga_code, lga_name)
        SELECT * FROM unnest($1::int[], $2::text[], $3::text[])
        ON CONFLICT (state_id, inec_lga_code) DO UPDATE SET lga_name = EXCLUDED.lga_name
        RETURNING id, state_id, inec_lga_code;
      `,
      [batch.map((row) => row.stateId), batch.map((row) => row.code), batch.map((row) => row.name)],
    )) as Array<{ id: number; state_id: number; inec_lga_code: string }>;
    for (const row of rows) {
      ids.set(`${row.state_id}/${row.inec_lga_code}`, row.id);
    }
  }
  return ids;
}

async function upsertWards(
  manager: EntityManager,
  states: PackedState[],
  stateIds: Map<string, number>,
  lgaIds: Map<string, number>,
): Promise<Map<string, number>> {
  const wards = states.flatMap((state) =>
    state.lgas.flatMap((lga) =>
      lga.wards.map((ward) => ({
        lgaId: lgaIds.get(`${stateIds.get(state.code)}/${lga.code}`) as number,
        code: ward.code,
        name: ward.name,
      })),
    ),
  );
  const ids = new Map<string, number>();
  for (const batch of chunk(wards, BATCH_SIZE)) {
    const rows = (await manager.query(
      `
        INSERT INTO ward (lga_id, inec_ward_code, ward_name)
        SELECT * FROM unnest($1::int[], $2::text[], $3::text[])
        ON CONFLICT (lga_id, inec_ward_code) DO UPDATE SET ward_name = EXCLUDED.ward_name
        RETURNING id, lga_id, inec_ward_code;
      `,
      [batch.map((row) => row.lgaId), batch.map((row) => row.code), batch.map((row) => row.name)],
    )) as Array<{ id: number; lga_id: number; inec_ward_code: string }>;
    for (const row of rows) {
      ids.set(`${row.lga_id}/${row.inec_ward_code}`, row.id);
    }
  }
  return ids;
}

async function upsertPollingUnits(
  manager: EntityManager,
  states: PackedState[],
  stateIds: Map<string, number>,
  lgaIds: Map<string, number>,
  wardIds: Map<string, number>,
): Promise<number> {
  const units = states.flatMap((state) =>
    state.lgas.flatMap((lga) => {
      const lgaId = lgaIds.get(`${stateIds.get(state.code)}/${lga.code}`);
      return lga.wards.flatMap((ward) =>
        ward.pollingUnits.map(([code, name]) => ({
          wardId: wardIds.get(`${lgaId}/${ward.code}`) as number,
          code: `${state.code}/${lga.code}/${ward.code}/${code}`,
          name,
        })),
      );
    }),
  );

  // latitude, longitude and is_position_doubtful are left untouched on conflict.
  for (const batch of chunk(units, BATCH_SIZE)) {
    await manager.query(
      `
        INSERT INTO polling_unit (ward_id, inec_polling_unit_code, polling_unit_name)
        SELECT * FROM unnest($1::int[], $2::text[], $3::text[])
        ON CONFLICT (inec_polling_unit_code) DO UPDATE
          SET polling_unit_name = EXCLUDED.polling_unit_name, ward_id = EXCLUDED.ward_id;
      `,
      [batch.map((row) => row.wardId), batch.map((row) => row.code), batch.map((row) => row.name)],
    );
  }
  return units.length;
}

export async function runInecSeed(): Promise<void> {
  const states = loadGeography();

  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      const stateIds = await upsertStates(manager, states);
      console.log(`states: ${stateIds.size}`);
      const lgaIds = await upsertLgas(manager, states, stateIds);
      console.log(`lgas: ${lgaIds.size}`);
      const wardIds = await upsertWards(manager, states, stateIds, lgaIds);
      console.log(`wards: ${wardIds.size}`);
      const unitCount = await upsertPollingUnits(manager, states, stateIds, lgaIds, wardIds);
      console.log(`polling units: ${unitCount}`);
    });

    const [totals] = (await dataSource.query(`
      SELECT
        (SELECT COUNT(*)::int FROM state) AS states,
        (SELECT COUNT(*)::int FROM lga) AS lgas,
        (SELECT COUNT(*)::int FROM ward) AS wards,
        (SELECT COUNT(*)::int FROM polling_unit) AS polling_units;
    `)) as Array<Record<string, number>>;
    console.log("database totals:", JSON.stringify(totals));
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  runInecSeed().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
