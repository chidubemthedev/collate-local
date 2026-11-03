import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { EntityManager } from "typeorm";
import dataSource from "../data-source";

type UnitType =
  | "country"
  | "state"
  | "senatorial_district"
  | "federal_constituency"
  | "state_constituency";

interface PackedUnit {
  type: Exclude<UnitType, "country" | "state">;
  state: string;
  name: string;
  lgas: string[];
  mapped: boolean;
}
interface PackedCandidate {
  kind: "pres" | "gov" | "sen" | "reps" | "sha";
  state: string;
  constituency: string;
  name: string;
  deputy?: string;
}

const DATA_DIR = join(process.cwd(), "data", "inec");
const OFFICE_BY_KIND: Record<PackedCandidate["kind"], string> = {
  pres: "President",
  gov: "Governor",
  sen: "Senate",
  reps: "House of Reps",
  sha: "State Assembly",
};
const UNIT_BY_KIND: Record<"sen" | "reps" | "sha", PackedUnit["type"]> = {
  sen: "senatorial_district",
  reps: "federal_constituency",
  sha: "state_constituency",
};

function readJson<T>(file: string): T {
  return JSON.parse(gunzipSync(readFileSync(join(DATA_DIR, file))).toString("utf8")) as T;
}

// Same normalisation as scripts/inec-build-political-units.py, so names match across sources.
function norm(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

class UnitIds {
  private readonly ids = new Map<string, number>();

  static key(type: UnitType, parentId: number | null, name: string): string {
    return `${type}|${parentId ?? ""}|${name}`;
  }

  async load(manager: EntityManager): Promise<void> {
    const rows = (await manager.query(
      `SELECT id, political_unit_name AS name, political_unit_type AS type, parent_political_unit_id AS parent FROM political_unit;`,
    )) as Array<{ id: number; name: string; type: UnitType; parent: number | null }>;
    for (const row of rows) {
      this.ids.set(UnitIds.key(row.type, row.parent, row.name), row.id);
    }
  }

  get(type: UnitType, parentId: number | null, name: string): number {
    return this.ids.get(UnitIds.key(type, parentId, name)) as number;
  }

  async ensure(
    manager: EntityManager,
    rows: Array<{ type: UnitType; parentId: number | null; name: string }>,
  ): Promise<void> {
    const missing = rows.filter((row) => !this.ids.has(UnitIds.key(row.type, row.parentId, row.name)));
    for (const batch of chunk(missing, 1000)) {
      const inserted = (await manager.query(
        `
          INSERT INTO political_unit (political_unit_name, political_unit_type, parent_political_unit_id)
          SELECT * FROM unnest($1::text[], $2::political_unit_type[], $3::int[])
          RETURNING id, political_unit_name AS name, political_unit_type AS type, parent_political_unit_id AS parent;
        `,
        [batch.map((row) => row.name), batch.map((row) => row.type), batch.map((row) => row.parentId)],
      )) as Array<{ id: number; name: string; type: UnitType; parent: number | null }>;
      for (const row of inserted) {
        this.ids.set(UnitIds.key(row.type, row.parent, row.name), row.id);
      }
    }
  }
}

async function seedUnits(manager: EntityManager, units: PackedUnit[], stateNames: Map<string, string>) {
  const ids = new UnitIds();
  await ids.load(manager);

  await ids.ensure(manager, [{ type: "country", parentId: null, name: "Nigeria" }]);
  const countryId = ids.get("country", null, "Nigeria");

  await ids.ensure(
    manager,
    [...stateNames.values()].map((name) => ({ type: "state" as const, parentId: countryId, name })),
  );
  const stateUnitId = (code: string) => ids.get("state", countryId, stateNames.get(code) as string);

  await ids.ensure(
    manager,
    units.map((unit) => ({ type: unit.type, parentId: stateUnitId(unit.state), name: unit.name })),
  );
  return { ids, countryId, stateUnitId };
}

async function seedMappings(
  manager: EntityManager,
  ids: UnitIds,
  countryId: number,
  stateUnitId: (code: string) => number,
  units: PackedUnit[],
  stateCodes: string[],
): Promise<void> {
  const allUnitIds = [
    countryId,
    ...stateCodes.map(stateUnitId),
    ...units.map((unit) => ids.get(unit.type, stateUnitId(unit.state), unit.name)),
  ];
  await manager.query(`DELETE FROM pu_political_unit WHERE political_unit_id = ANY($1::int[]);`, [allUnitIds]);

  await manager.query(
    `INSERT INTO pu_political_unit (political_unit_id, polling_unit_id) SELECT $1, id FROM polling_unit;`,
    [countryId],
  );
  await manager.query(
    `
      INSERT INTO pu_political_unit (political_unit_id, polling_unit_id)
      SELECT u.unit_id, pu.id
      FROM unnest($1::int[], $2::text[]) AS u(unit_id, state_code)
      JOIN state s ON s.inec_state_code = u.state_code
      JOIN lga l ON l.state_id = s.id
      JOIN ward w ON w.lga_id = l.id
      JOIN polling_unit pu ON pu.ward_id = w.id;
    `,
    [stateCodes.map(stateUnitId), stateCodes],
  );

  const mapped = units.filter((unit) => unit.mapped);
  const rows = mapped.flatMap((unit) =>
    unit.lgas.map((lga) => ({
      unitId: ids.get(unit.type, stateUnitId(unit.state), unit.name),
      state: unit.state,
      lga,
    })),
  );
  for (const batch of chunk(rows, 400)) {
    await manager.query(
      `
        INSERT INTO pu_political_unit (political_unit_id, polling_unit_id)
        SELECT u.unit_id, pu.id
        FROM unnest($1::int[], $2::text[], $3::text[]) AS u(unit_id, state_code, lga_code)
        JOIN state s ON s.inec_state_code = u.state_code
        JOIN lga l ON l.state_id = s.id AND l.inec_lga_code = u.lga_code
        JOIN ward w ON w.lga_id = l.id
        JOIN polling_unit pu ON pu.ward_id = w.id
        ON CONFLICT DO NOTHING;
      `,
      [batch.map((row) => row.unitId), batch.map((row) => row.state), batch.map((row) => row.lga)],
    );
  }
}

async function seedSeats(
  manager: EntityManager,
  ids: UnitIds,
  countryId: number,
  stateUnitId: (code: string) => number,
  units: PackedUnit[],
  stateCodes: string[],
): Promise<Map<string, number>> {
  const offices = (await manager.query(`SELECT id, office_name FROM office;`)) as Array<{ id: number; office_name: string }>;
  const officeId = new Map(offices.map((office) => [office.office_name, office.id]));
  for (const name of Object.values(OFFICE_BY_KIND)) {
    if (!officeId.has(name)) {
      throw new Error(`Office "${name}" is missing. Run the office seed first (npm run db:seed).`);
    }
  }

  const wanted: Array<{ office: number; unit: number }> = [{ office: officeId.get("President") as number, unit: countryId }];
  for (const code of stateCodes) {
    if (code !== "37") {
      wanted.push({ office: officeId.get("Governor") as number, unit: stateUnitId(code) });
    }
  }
  const officeForType: Record<PackedUnit["type"], string> = {
    senatorial_district: "Senate",
    federal_constituency: "House of Reps",
    state_constituency: "State Assembly",
  };
  for (const unit of units) {
    wanted.push({
      office: officeId.get(officeForType[unit.type]) as number,
      unit: ids.get(unit.type, stateUnitId(unit.state), unit.name),
    });
  }

  for (const batch of chunk(wanted, 1000)) {
    await manager.query(
      `
        INSERT INTO seat (office_id, political_unit_id)
        SELECT * FROM unnest($1::int[], $2::int[])
        ON CONFLICT (office_id, political_unit_id) DO NOTHING;
      `,
      [batch.map((row) => row.office), batch.map((row) => row.unit)],
    );
  }
  const seats = (await manager.query(`SELECT id, office_id, political_unit_id FROM seat;`)) as Array<{
    id: number;
    office_id: number;
    political_unit_id: number;
  }>;
  return new Map(seats.map((seat) => [`${seat.office_id}|${seat.political_unit_id}`, seat.id]));
}

async function seedCandidates(
  manager: EntityManager,
  ids: UnitIds,
  countryId: number,
  stateUnitId: (code: string) => number,
  units: PackedUnit[],
  seatIds: Map<string, number>,
  stateCodeByName: Map<string, string>,
): Promise<{ created: number; skipped: string[] }> {
  const offices = (await manager.query(`SELECT id, office_name FROM office;`)) as Array<{ id: number; office_name: string }>;
  const officeId = new Map(offices.map((office) => [office.office_name, office.id]));
  const candidates = readJson<{ ndc: PackedCandidate[] }>("candidates.json.gz").ndc;

  const unitKey = (type: PackedUnit["type"], state: string, name: string) => `${type}|${state}|${norm(name)}`;
  const unitByName = new Map<string, number>();
  for (const unit of units) {
    unitByName.set(unitKey(unit.type, unit.state, unit.name), ids.get(unit.type, stateUnitId(unit.state), unit.name));
  }

  const existing = (await manager.query(`
    SELECT c.id, c.seat_id, c.principal_candidate_id, p.full_name
    FROM candidate c JOIN person p ON p.id = c.person_id;
  `)) as Array<{ id: number; seat_id: number | null; principal_candidate_id: number | null; full_name: string }>;
  const known = new Set(
    existing.map((row) =>
      row.seat_id !== null ? `S|${row.seat_id}|${row.full_name}` : `D|${row.principal_candidate_id}|${row.full_name}`,
    ),
  );

  const skipped: string[] = [];
  const principals: Array<{ personId: string; name: string; seatId: number; deputy: string }> = [];
  for (const row of candidates) {
    const name = row.name.trim();
    if (!name) {
      skipped.push(`${row.kind} ${row.state}: no candidate named in INEC's list`);
      continue;
    }
    const stateCode = stateCodeByName.get(norm(row.state));
    let unitId: number | undefined;
    if (row.kind === "pres") {
      unitId = countryId;
    } else if (row.kind === "gov") {
      unitId = stateCode ? stateUnitId(stateCode) : undefined;
    } else if (stateCode) {
      unitId = unitByName.get(unitKey(UNIT_BY_KIND[row.kind], stateCode, row.constituency));
    }
    const seatId = unitId === undefined ? undefined : seatIds.get(`${officeId.get(OFFICE_BY_KIND[row.kind])}|${unitId}`);
    if (seatId === undefined) {
      skipped.push(`${row.kind} ${row.state} ${row.constituency}: no matching seat for ${name}`);
      continue;
    }
    if (known.has(`S|${seatId}|${name}`)) {
      continue;
    }
    principals.push({ personId: randomUUID(), name, seatId, deputy: (row.deputy ?? "").trim() });
  }

  let created = 0;
  const candidateIdByPerson = new Map<string, number>();
  for (const batch of chunk(principals, 1000)) {
    await manager.query(`INSERT INTO person (id, full_name) SELECT * FROM unnest($1::uuid[], $2::text[]);`, [
      batch.map((row) => row.personId),
      batch.map((row) => row.name),
    ]);
    const inserted = (await manager.query(
      `INSERT INTO candidate (person_id, seat_id) SELECT * FROM unnest($1::uuid[], $2::int[]) RETURNING id, person_id;`,
      [batch.map((row) => row.personId), batch.map((row) => row.seatId)],
    )) as Array<{ id: number; person_id: string }>;
    for (const row of inserted) {
      candidateIdByPerson.set(row.person_id, row.id);
    }
    created += inserted.length;
  }

  const deputies = principals
    .filter((row) => row.deputy)
    .map((row) => ({ personId: randomUUID(), name: row.deputy, principalId: candidateIdByPerson.get(row.personId) as number }))
    .filter((row) => !known.has(`D|${row.principalId}|${row.name}`));
  for (const batch of chunk(deputies, 1000)) {
    await manager.query(`INSERT INTO person (id, full_name) SELECT * FROM unnest($1::uuid[], $2::text[]);`, [
      batch.map((row) => row.personId),
      batch.map((row) => row.name),
    ]);
    await manager.query(
      `INSERT INTO candidate (person_id, principal_candidate_id) SELECT * FROM unnest($1::uuid[], $2::int[]);`,
      [batch.map((row) => row.personId), batch.map((row) => row.principalId)],
    );
    created += batch.length;
  }
  return { created, skipped };
}

export async function runInecPoliticsSeed(): Promise<void> {
  const { units } = readJson<{ units: PackedUnit[] }>("political-units.json.gz");

  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      const states = (await manager.query(`SELECT inec_state_code AS code, state_name AS name FROM state ORDER BY inec_state_code;`)) as Array<{
        code: string;
        name: string;
      }>;
      if (states.length !== 37) {
        throw new Error("INEC geography is not loaded. Run npm run db:seed:inec first.");
      }
      const stateNames = new Map(states.map((state) => [state.code, state.name]));
      const stateCodeByName = new Map(states.map((state) => [norm(state.name), state.code]));
      const stateCodes = states.map((state) => state.code);

      const { ids, countryId, stateUnitId } = await seedUnits(manager, units, stateNames);
      console.log(`political units: ${units.length + states.length + 1}`);
      await seedMappings(manager, ids, countryId, stateUnitId, units, stateCodes);
      const seatIds = await seedSeats(manager, ids, countryId, stateUnitId, units, stateCodes);
      console.log(`seats: ${seatIds.size}`);
      const { created, skipped } = await seedCandidates(manager, ids, countryId, stateUnitId, units, seatIds, stateCodeByName);
      console.log(`candidates created: ${created}`);
      if (skipped.length > 0) {
        console.log(`skipped ${skipped.length}:`);
        for (const line of skipped.slice(0, 40)) {
          console.log(`  ${line}`);
        }
      }
    });

    const totals = (await dataSource.query(`
      SELECT
        (SELECT COUNT(*)::int FROM political_unit) AS political_units,
        (SELECT COUNT(*)::int FROM pu_political_unit) AS pu_political_unit,
        (SELECT COUNT(*)::int FROM seat) AS seats,
        (SELECT COUNT(*)::int FROM candidate) AS candidates;
    `)) as Array<Record<string, number>>;
    console.log("database totals:", JSON.stringify(totals[0]));
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  runInecPoliticsSeed().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
