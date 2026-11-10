import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { EntityManager } from "typeorm";
import dataSource from "../../data-source";
import { CONSENT_TEXT_VERSION } from "../../../channels/telegram/consent-text";
import { AgentKind } from "../../entities/agent-assignment.entity";
import { GroupType } from "../../entities/group.entity";
import { demoFaker, makeDemoName, assertDemoSeedAllowed } from "./utils";

export const TARGET_COVERAGE = 0.45;
export const COVERAGE_TOLERANCE_POINTS = 0.3;
export const TARGET_TOTAL_AGENTS = 100_000;
export const BATCH_SIZE = 1000;

const WARD_CHUNK = 200;
// Share of extra agents owned by a candidate whose seat covers the unit (the rest stay group-owned).
const CANDIDATE_EXTRA_SHARE_PERCENT = 40;
const SELECTION_SEED = "collate-demo-agents-2026";
const DEMO_EMAIL_PATTERN = "%@demo.collate.test";
const DEMO_PHONE_PATTERN = "+234000000%";
const PHONE_PREFIX = "+234000000";
const MAX_PHONE_SUFFIX = 999_999;
const REAL_STATE_FILTER = "state.inec_state_code !~ '^9[0-9]$'";

interface WardRow {
  id: number;
  lgaId: number;
  stateId: number;
  units: number;
  officials: number;
  extras: number;
}

interface GroupRow {
  id: number;
  groupType: GroupType;
  parentGroupId: number | null;
}

interface PendingAssignment {
  unitId: number;
  kind: AgentKind;
  slot: number;
  groupId: number | null;
  candidateId?: number | null;
}

type GeographyCounts = Record<
  "state" | "lga" | "ward" | "polling_unit" | "political_unit" | "pu_political_unit",
  number
>;

const sequences = { phone: 0, chat: BigInt(0), email: 0 };
const MIN_DEMO_CHAT_ID = BigInt("9000000000");

async function confirmDevelopmentDatabase(): Promise<void> {
  if (!stdin.isTTY) {
    throw new Error("Run this seed in an interactive terminal and confirm the database first.");
  }

  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await prompt.question(
      'Confirm this is a development or demo database by typing "development" or "demo": ',
    );
    if (!["development", "demo"].includes(answer.trim().toLowerCase())) {
      throw new Error("Database confirmation was not provided.");
    }
  } finally {
    prompt.close();
  }
}

function buildInsert(
  table: string,
  columns: string[],
  rows: unknown[][],
): { sql: string; parameters: unknown[] } {
  const parameters: unknown[] = [];
  const values = rows.map((row) => {
    const placeholders = row.map((value) => {
      parameters.push(value);
      return `$${parameters.length}`;
    });
    return `(${placeholders.join(", ")})`;
  });
  if (parameters.length > 65_535) {
    throw new Error("Insert statement would exceed the parameter limit.");
  }
  return {
    sql: `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${values.join(", ")}`,
    parameters,
  };
}

async function geographyCounts(manager: EntityManager): Promise<GeographyCounts> {
  const rows = (await manager.query(`
    SELECT 'state' AS table_name, COUNT(*)::int AS count FROM state
    UNION ALL SELECT 'lga', COUNT(*)::int FROM lga
    UNION ALL SELECT 'ward', COUNT(*)::int FROM ward
    UNION ALL SELECT 'polling_unit', COUNT(*)::int FROM polling_unit
    UNION ALL SELECT 'political_unit', COUNT(*)::int FROM political_unit
    UNION ALL SELECT 'pu_political_unit', COUNT(*)::int FROM pu_political_unit;
  `)) as Array<{ table_name: keyof GeographyCounts; count: number | string }>;

  const counts = Object.fromEntries(rows.map((row) => [row.table_name, Number(row.count)]));
  if (Object.keys(counts).length !== 6) {
    throw new Error("Geography count query returned an incomplete result.");
  }
  return counts as GeographyCounts;
}

async function loadDemoGroups(manager: EntityManager): Promise<{
  officialGroupId: number;
  extraGroupIds: number[];
}> {
  const groups = (await manager.query(
    `
      WITH demo_memberships AS (
        SELECT DISTINCT membership.group_id
        FROM membership
        JOIN person ON person.id = membership.person_id
        WHERE person.email_address LIKE $1
           OR EXISTS (
             SELECT 1 FROM phone_number
             WHERE phone_number.person_id = person.id
               AND phone_number.e164_number LIKE $2
           )
      ), demo_group_ids AS (
        SELECT group_id FROM demo_memberships
        UNION
        SELECT groups.parent_group_id
        FROM groups
        JOIN demo_memberships ON demo_memberships.group_id = groups.id
        WHERE groups.parent_group_id IS NOT NULL
      )
      SELECT DISTINCT groups.id, group_type.type_key AS "groupType",
             groups.parent_group_id AS "parentGroupId"
      FROM groups
      JOIN group_type ON group_type.id = groups.group_type_id
      JOIN demo_group_ids ON demo_group_ids.group_id = groups.id
      WHERE group_type.type_key IN ('party', 'campaign', 'support_group');
    `,
    [DEMO_EMAIL_PATTERN, DEMO_PHONE_PATTERN],
  )) as GroupRow[];

  const masters = groups.filter(
    (group) => group.groupType === GroupType.PARTY && group.parentGroupId === null,
  );
  // The party's state chapters (children of the party group) are not extra owners.
  const partyId = masters[0]?.id;
  const extras = groups.filter(
    (group) =>
      (group.groupType === GroupType.CAMPAIGN || group.groupType === GroupType.SUPPORT_GROUP) &&
      group.parentGroupId !== partyId,
  );
  if (masters.length !== 1 || extras.length === 0) {
    throw new Error("Existing demo groups are missing; run the existing demo seed first.");
  }

  return {
    officialGroupId: masters[0].id,
    extraGroupIds: extras.map((group) => group.id),
  };
}

async function loadWards(manager: EntityManager): Promise<WardRow[]> {
  const wards = (await manager.query(`
    SELECT ward.id, lga.id AS "lgaId", lga.state_id AS "stateId",
           COUNT(polling_unit.id)::int AS units
    FROM ward
    JOIN lga ON lga.id = ward.lga_id
    JOIN state ON state.id = lga.state_id
    JOIN polling_unit ON polling_unit.ward_id = ward.id
    WHERE ${REAL_STATE_FILTER}
    GROUP BY ward.id, lga.id
    ORDER BY ward.id;
  `)) as Array<Omit<WardRow, "officials" | "extras">>;

  const assigned = (await manager.query(`
    SELECT polling_unit.ward_id AS "wardId",
           COUNT(*) FILTER (WHERE agent_assignment.agent_kind = 'official')::int AS officials,
           COUNT(*) FILTER (WHERE agent_assignment.agent_kind = 'extra')::int AS extras
    FROM agent_assignment
    JOIN polling_unit ON polling_unit.id = agent_assignment.polling_unit_id
    JOIN ward ON ward.id = polling_unit.ward_id
    JOIN lga ON lga.id = ward.lga_id
    JOIN state ON state.id = lga.state_id
    WHERE ${REAL_STATE_FILTER}
    GROUP BY polling_unit.ward_id;
  `)) as Array<{ wardId: number; officials: number; extras: number }>;
  const byWard = new Map(assigned.map((row) => [Number(row.wardId), row]));

  return wards.map((ward) => ({
    id: Number(ward.id),
    lgaId: Number(ward.lgaId),
    stateId: Number(ward.stateId),
    units: Number(ward.units),
    officials: Number(byWard.get(Number(ward.id))?.officials ?? 0),
    extras: Number(byWard.get(Number(ward.id))?.extras ?? 0),
  }));
}

function unitInterval(key: string): number {
  return createHash("md5").update(SELECTION_SEED + key).digest().readUInt32BE(0) / 4_294_967_295;
}

// Per-state, per-LGA and per-ward density factors, rescaled so the weighted mean hits the target.
function planOfficialQuotas(wards: WardRow[], target: number): number[] {
  const density = wards.map(
    (ward) =>
      (0.15 + 0.65 * unitInterval(`s${ward.stateId}`)) *
      (0.5 + unitInterval(`l${ward.lgaId}`)) *
      (0.05 + 1.95 * unitInterval(`w${ward.id}`)),
  );
  const quotaFor = (scale: number, index: number): number =>
    Math.max(
      wards[index].officials,
      Math.round(Math.min(1, density[index] * scale) * wards[index].units),
    );
  const total = (scale: number): number =>
    wards.reduce((sum, _ward, index) => sum + quotaFor(scale, index), 0);

  let low = 0;
  let high = 1000;
  for (let step = 0; step < 60; step += 1) {
    const middle = (low + high) / 2;
    if (total(middle) < target) low = middle;
    else high = middle;
  }

  const quotas = wards.map((_ward, index) => quotaFor(high, index));
  let difference = target - quotas.reduce((sum, quota) => sum + quota, 0);
  const order = wards
    .map((ward, index) => ({ index, key: unitInterval(`r${ward.id}`) }))
    .sort((left, right) => left.key - right.key);
  while (difference !== 0) {
    let changed = false;
    for (const { index } of order) {
      if (difference === 0) break;
      const step = difference > 0 ? 1 : -1;
      const next = quotas[index] + step;
      if (next >= wards[index].officials && next <= wards[index].units) {
        quotas[index] = next;
        difference -= step;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return quotas;
}

// High-coverage wards (>80%) put extras on about half their covered units; <10% get none.
function planExtraQuotas(wards: WardRow[], covered: number[], target: number): number[] {
  const share = (index: number): number => covered[index] / wards[index].units;
  const highRate = 0.75;
  let highSum = 0;
  let midSum = 0;
  covered.forEach((count, index) => {
    if (share(index) > 0.8) highSum += count;
    else if (share(index) >= 0.1) midSum += count;
  });

  let high = highRate;
  let mid = midSum > 0 ? (target - highRate * highSum) / midSum : 0;
  if (mid < 0) {
    mid = 0;
    high = highSum > 0 ? target / highSum : 0;
  }
  mid = Math.min(mid, 1.5);

  return covered.map((count, index) => {
    const rate = share(index) > 0.8 ? high : share(index) >= 0.1 ? mid : 0;
    return Math.min(Math.round(rate * count), 2 * count);
  });
}

async function loadContactSequences(manager: EntityManager): Promise<void> {
  const rows = (await manager.query(`
    SELECT
      (SELECT COALESCE(MAX(SUBSTRING(e164_number FROM '^\\+234000000([0-9]+)$')::bigint), 0)
        FROM phone_number) AS "maxPhone",
      (SELECT COALESCE(MAX(telegram_chat_id), 9000000000)::text
        FROM phone_number) AS "maxChat",
      (SELECT COALESCE(MAX(SUBSTRING(LOWER(email_address) FROM '^agent\\.([0-9]+)@demo\\.collate\\.test$')::bigint), 0)
        FROM person) AS "maxEmail";
  `)) as Array<{ maxPhone: string | number; maxChat: string; maxEmail: string | number }>;
  const row = rows[0];
  if (!row) throw new Error("Contact sequence query returned no result.");

  sequences.phone = Number(row.maxPhone);
  const chat = BigInt(row.maxChat);
  sequences.chat = chat < MIN_DEMO_CHAT_ID ? MIN_DEMO_CHAT_ID : chat;
  sequences.email = Number(row.maxEmail);
}

function nextPhone(): string {
  if (sequences.phone >= MAX_PHONE_SUFFIX) {
    throw new Error("No demo phone numbers remain in the configured range.");
  }
  sequences.phone += 1;
  return `${PHONE_PREFIX}${String(sequences.phone).padStart(6, "0")}`;
}

function nextChatId(): string {
  sequences.chat += BigInt(1);
  return sequences.chat.toString();
}

async function insertBatch(
  manager: EntityManager,
  batch: PendingAssignment[],
): Promise<void> {
  const now = new Date();
  const personRows: unknown[][] = [];
  const phoneRows: unknown[][] = [];
  const consentRows: unknown[][] = [];
  const assignmentRows: unknown[][] = [];

  batch.forEach((assignment, index) => {
    const personId = randomUUID();
    const statusRoll = demoFaker.number.int({ min: 0, max: 99 });
    const status = statusRoll < 75 ? "verified" : statusRoll < 90 ? "unverified" : "rejected";
    const email = index % 5 < 3
      ? `agent.${(sequences.email += 1)}@demo.collate.test`
      : null;
    personRows.push([personId, makeDemoName(), email, status, now, now]);

    const phoneCount = demoFaker.number.int({ min: 0, max: 99 }) < 15 ? 2 : 1;
    for (let phoneIndex = 0; phoneIndex < phoneCount; phoneIndex += 1) {
      const confirmed = demoFaker.number.int({ min: 0, max: 99 }) < 80;
      phoneRows.push([personId, nextPhone(), confirmed, confirmed ? nextChatId() : null]);
    }

    const consentRoll = demoFaker.number.int({ min: 0, max: 99 });
    if (consentRoll < 95) {
      consentRows.push([personId, CONSENT_TEXT_VERSION, consentRoll < 90]);
    }
    assignmentRows.push([
      personId,
      assignment.unitId,
      assignment.candidateId ? null : assignment.groupId,
      assignment.candidateId ?? null,
      assignment.kind,
      assignment.slot,
    ]);
  });

  const statements = [
    buildInsert(
      "person",
      ["id", "full_name", "email_address", "verification_status", "created_at", "updated_at"],
      personRows,
    ),
    buildInsert("phone_number", ["person_id", "e164_number", "is_confirmed", "telegram_chat_id"], phoneRows),
    ...(consentRows.length > 0
      ? [buildInsert("consent", ["person_id", "consent_text_version", "is_accepted"], consentRows)]
      : []),
    buildInsert(
      "agent_assignment",
      ["person_id", "polling_unit_id", "owner_group_id", "owner_candidate_id", "agent_kind", "slot_number"],
      assignmentRows,
    ),
  ];
  for (const statement of statements) {
    await manager.query(statement.sql, statement.parameters);
  }
}

function createWriter(): {
  push: (items: PendingAssignment[]) => Promise<void>;
  finish: () => Promise<void>;
} {
  const pending: PendingAssignment[] = [];
  const drain = async (force: boolean): Promise<void> => {
    while (pending.length >= BATCH_SIZE || (force && pending.length > 0)) {
      const batch = pending.splice(0, BATCH_SIZE);
      await dataSource.transaction((manager) => insertBatch(manager, batch));
    }
  };
  return {
    push: async (items) => {
      pending.push(...items);
      await drain(false);
    },
    finish: () => drain(true),
  };
}

const OFFICIAL_UNITS_SQL = `
  SELECT q.ward_id AS "wardId", picked.id
  FROM unnest($1::int[], $2::int[]) AS q(ward_id, n)
  CROSS JOIN LATERAL (
    SELECT candidate.id
    FROM (
      SELECT polling_unit.id,
             ROW_NUMBER() OVER (ORDER BY md5(polling_unit.id::text || $3)) AS rn
      FROM polling_unit
      WHERE polling_unit.ward_id = q.ward_id
        AND NOT EXISTS (
          SELECT 1 FROM agent_assignment official
          WHERE official.polling_unit_id = polling_unit.id
            AND official.agent_kind = 'official'
        )
    ) candidate
    WHERE candidate.rn <= q.n
  ) picked;
`;

const EXTRA_UNITS_SQL = `
  SELECT picked.*,
    (
      SELECT c.id
      FROM pu_political_unit ppu
      JOIN seat st ON st.political_unit_id = ppu.political_unit_id
      JOIN candidate c ON c.seat_id = st.id
      WHERE ppu.polling_unit_id = picked.id
        AND c.principal_candidate_id IS NULL
      ORDER BY md5(c.id::text || picked.id::text || $3)
      LIMIT 1
    ) AS "candidateId"
  FROM (
  SELECT q.ward_id AS "wardId", picked.id, picked.slots
  FROM unnest($1::int[], $2::int[]) AS q(ward_id, n)
  CROSS JOIN LATERAL (
    SELECT candidate.id, candidate.slots
    FROM (
      SELECT polling_unit.id,
             ARRAY(
               SELECT slot.slot_number FROM agent_assignment slot
               WHERE slot.polling_unit_id = polling_unit.id
             ) AS slots,
             ROW_NUMBER() OVER (ORDER BY md5(polling_unit.id::text || $3 || 'x')) AS rn
      FROM polling_unit
      WHERE polling_unit.ward_id = q.ward_id
        AND EXISTS (
          SELECT 1 FROM agent_assignment official
          WHERE official.polling_unit_id = polling_unit.id
            AND official.agent_kind = 'official'
        )
        AND (
          SELECT COUNT(*) FROM agent_assignment total
          WHERE total.polling_unit_id = polling_unit.id
        ) < 3
    ) candidate
    WHERE candidate.rn <= q.n
  ) picked
  ) picked;
`;

async function seedOfficials(
  wards: WardRow[],
  quotas: number[],
  groupId: number,
): Promise<number> {
  const work = wards
    .map((ward, index) => ({ id: ward.id, missing: quotas[index] - ward.officials }))
    .filter((ward) => ward.missing > 0);
  const writer = createWriter();
  let created = 0;

  for (let offset = 0; offset < work.length; offset += WARD_CHUNK) {
    const chunk = work.slice(offset, offset + WARD_CHUNK);
    const rows = (await dataSource.query(OFFICIAL_UNITS_SQL, [
      chunk.map((ward) => ward.id),
      chunk.map((ward) => ward.missing),
      SELECTION_SEED,
    ])) as Array<{ id: number }>;
    created += rows.length;
    await writer.push(
      rows.map((row) => ({
        unitId: Number(row.id),
        kind: AgentKind.OFFICIAL,
        slot: 0,
        groupId,
      })),
    );
  }
  await writer.finish();
  return created;
}

async function seedExtras(
  wards: WardRow[],
  quotas: number[],
  groupIds: number[],
): Promise<number> {
  const work = wards
    .map((ward, index) => ({ id: ward.id, missing: quotas[index] - ward.extras }))
    .filter((ward) => ward.missing > 0);
  const writer = createWriter();
  let created = 0;

  for (let offset = 0; offset < work.length; offset += WARD_CHUNK) {
    const chunk = work.slice(offset, offset + WARD_CHUNK);
    const unitsWanted = chunk.map((ward) => Math.ceil((ward.missing * 2) / 3));
    const rows = (await dataSource.query(EXTRA_UNITS_SQL, [
      chunk.map((ward) => ward.id),
      unitsWanted,
      SELECTION_SEED,
    ])) as Array<{ wardId: number; id: number; slots: number[]; candidateId: number | null }>;

    const rowsByWard = new Map<number, Array<{ id: number; slots: number[]; candidateId: number | null }>>();
    for (const row of rows) {
      const list = rowsByWard.get(Number(row.wardId)) ?? [];
      list.push({
        id: Number(row.id),
        slots: row.slots ?? [],
        candidateId: row.candidateId === null ? null : Number(row.candidateId),
      });
      rowsByWard.set(Number(row.wardId), list);
    }

    const items: PendingAssignment[] = [];
    for (const ward of chunk) {
      const units = rowsByWard.get(ward.id) ?? [];
      let secondExtras = Math.max(0, ward.missing - units.length);
      for (const unit of units) {
        const free = [1, 2].filter((slot) => !unit.slots.includes(slot));
        const wanted = secondExtras > 0 ? 2 : 1;
        if (wanted === 2) secondExtras -= 1;
        for (const slot of free.slice(0, wanted)) {
          const candidateOwned =
            unit.candidateId !== null &&
            demoFaker.number.int({ min: 0, max: 99 }) < CANDIDATE_EXTRA_SHARE_PERCENT;
          items.push({
            unitId: unit.id,
            kind: AgentKind.EXTRA,
            slot,
            groupId: candidateOwned
              ? null
              : groupIds[demoFaker.number.int({ min: 0, max: groupIds.length - 1 })],
            candidateId: candidateOwned ? unit.candidateId : null,
          });
        }
      }
    }
    created += items.length;
    await writer.push(items);
  }
  await writer.finish();
  return created;
}

async function run(): Promise<void> {
  assertDemoSeedAllowed();
  await confirmDevelopmentDatabase();
  await dataSource.initialize();

  try {
    const total = (await dataSource.query(
      "SELECT COUNT(*)::int AS count FROM polling_unit",
    )) as Array<{ count: number | string }>;
    if (Number(total[0]?.count ?? 0) < 100_000) {
      throw new Error("Real INEC polling-unit data is not loaded in this database.");
    }

    const countsBefore = await geographyCounts(dataSource.manager);
    const groups = await loadDemoGroups(dataSource.manager);
    const wards = await loadWards(dataSource.manager);
    const totalUnits = wards.reduce((sum, ward) => sum + ward.units, 0);
    const officialTarget = Math.round(TARGET_COVERAGE * totalUnits);
    const extraTarget = Math.max(0, TARGET_TOTAL_AGENTS - officialTarget);

    await loadContactSequences(dataSource.manager);

    const officialQuotas = planOfficialQuotas(wards, officialTarget);
    const createdOfficials = await seedOfficials(wards, officialQuotas, groups.officialGroupId);

    const extraQuotas = planExtraQuotas(wards, officialQuotas, extraTarget);
    const createdExtras = await seedExtras(wards, extraQuotas, groups.extraGroupIds);

    const countsAfter = await geographyCounts(dataSource.manager);
    const stats = (await dataSource.query(`
      SELECT
        COUNT(DISTINCT agent_assignment.polling_unit_id)
          FILTER (WHERE agent_assignment.agent_kind = 'official')::int AS covered,
        COUNT(*) FILTER (WHERE agent_assignment.agent_kind = 'official')::int AS officials,
        COUNT(*) FILTER (WHERE agent_assignment.agent_kind = 'extra')::int AS extras
      FROM agent_assignment
      JOIN polling_unit ON polling_unit.id = agent_assignment.polling_unit_id
      JOIN ward ON ward.id = polling_unit.ward_id
      JOIN lga ON lga.id = ward.lga_id
      JOIN state ON state.id = lga.state_id
      WHERE ${REAL_STATE_FILTER};
    `)) as Array<{ covered: number; officials: number; extras: number }>;
    const checks = (await dataSource.query(`
      SELECT
        (SELECT COUNT(*)::int FROM (
          SELECT polling_unit_id FROM agent_assignment
          WHERE agent_kind = 'official'
          GROUP BY polling_unit_id HAVING COUNT(*) > 1
        ) multiple) AS "multipleOfficials",
        (SELECT COUNT(*)::int FROM (
          SELECT e164_number FROM phone_number
          GROUP BY e164_number HAVING COUNT(*) > 1
        ) duplicates) AS "duplicateNumbers";
    `)) as Array<{ multipleOfficials: number; duplicateNumbers: number }>;

    const covered = Number(stats[0]?.covered ?? 0);
    const coveragePercent = totalUnits > 0
      ? Math.round((covered / totalUnits) * 10_000) / 100
      : 0;
    const multipleOfficials = Number(checks[0]?.multipleOfficials ?? 0);
    const duplicateNumbers = Number(checks[0]?.duplicateNumbers ?? 0);
    const geographyUnchanged =
      JSON.stringify(countsBefore) === JSON.stringify(countsAfter);

    console.log(JSON.stringify({
      pollingUnits: totalUnits,
      coveredUnits: covered,
      coveragePercent,
      officialAgents: Number(stats[0]?.officials ?? 0),
      extraAgents: Number(stats[0]?.extras ?? 0),
      createdOfficialAgents: createdOfficials,
      createdExtraAgents: createdExtras,
      unitsWithMultipleOfficials: multipleOfficials,
      duplicateNumbers,
      geographyBefore: countsBefore,
      geographyAfter: countsAfter,
    }));

    if (Math.abs(coveragePercent - TARGET_COVERAGE * 100) > COVERAGE_TOLERANCE_POINTS) {
      throw new Error("Final coverage is outside the allowed tolerance.");
    }
    if (multipleOfficials > 0 || duplicateNumbers > 0 || !geographyUnchanged) {
      throw new Error("One or more demo-agent seed invariants failed.");
    }
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  void run().catch((error: unknown) => {
    const name = error instanceof Error ? error.name : "Error";
    const code = (error as { code?: unknown } | null)?.code;
    const ownMessage = error instanceof Error && error.name === "Error" && !code
      ? `: ${error.message}`
      : "";
    console.error(`Demo agent seed failed (${name}${typeof code === "string" ? ` ${code}` : ""})${ownMessage}.`);
    process.exitCode = 1;
  });
}
