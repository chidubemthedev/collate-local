/**
 * The fixed test fixture behind the manual test script ("Collate v1 — test script" Google Sheet,
 * tabs "Personas" and "Fixture data"). Every expected figure in the scope tests and the manual
 * script depends on exactly this data, so change both together.
 *
 * Eight polling units (PU-A … PU-H) in four states, the political units above them, one NDC
 * candidate per seat in the fixture, and the personas P01–P26 (P23 and P25 are deliberately
 * not seeded: P23 is not on any list, P25 is invited during the tests).
 *
 * The fixture uses its own codes (state codes 24, 22, 04, 20 as in INEC data) and is meant for an
 * empty test database. `resetTestDatabase` empties every table first.
 */

export interface Queryable {
  query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T>;
}

export type PuKey = "PU-A" | "PU-B" | "PU-C" | "PU-D" | "PU-E" | "PU-F" | "PU-G" | "PU-H";

export type PersonaKey =
  | "P01" | "P02" | "P03" | "P04" | "P05" | "P06" | "P07" | "P08" | "P09"
  | "P10" | "P11" | "P12" | "P13" | "P14" | "P15" | "P16" | "P17" | "P18" | "P19"
  | "P20" | "P21" | "P22" | "P24" | "P26" | "AGENT_F" | "AGENT_G";

export interface TestFixture {
  personIds: Record<PersonaKey, string>;
  emails: Partial<Record<PersonaKey, string>>;
  candidateIds: Partial<Record<PersonaKey, number>>;
  seatIds: Partial<Record<PersonaKey, number>>;
  pollingUnitIds: Record<PuKey, number>;
  stateIds: Record<"Lagos" | "Kogi" | "Anambra" | "Kano", number>;
  lgaIds: Record<"Ikeja" | "Ikorodu" | "Lokoja" | "Awka South" | "Tudun Wada", number>;
  wardIds: Record<"Ikeja Ward 01" | "Ikeja Ward 02", number>;
  politicalUnitIds: Record<string, number>;
  groupIds: Record<string, number>;
  officeIds: Record<"President" | "Governor" | "Senate" | "House of Reps" | "State Assembly", number>;
}

/**
 * Tables the reset leaves alone. `migrations` is never touched. `group_type` holds the four
 * built-in types (admin, party, campaign, support group) that a migration inserts and the fixture
 * looks up by key; only types added after that are removed (see `resetTestDatabase`).
 */
const RESET_EXCLUDED_TABLES = new Set(["migrations", "group_type"]);

/**
 * Refuses to run anywhere that could be real: production, or a database whose name does not
 * contain "test" (set ALLOW_TEST_DB_RESET=true to override for a throwaway database).
 */
export function assertTestDatabase(databaseUrl: string | undefined): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The test fixture cannot run with NODE_ENV=production.");
  }
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }
  const name = new URL(databaseUrl).pathname.replace(/^\//, "");
  if (!/test/i.test(name) && process.env.ALLOW_TEST_DB_RESET !== "true") {
    throw new Error(
      `Refusing to reset database "${name}": its name does not contain "test". ` +
        "Point DATABASE_URL at a throwaway database (e.g. collate_test) or set ALLOW_TEST_DB_RESET=true.",
    );
  }
}

/** Empties every application table (TRUNCATE skips the audit_log row trigger). */
export async function resetTestDatabase(db: Queryable): Promise<void> {
  const rows = await db.query<Array<{ tablename: string }>>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`,
  );
  const tables = rows.map((row) => row.tablename).filter((name) => !RESET_EXCLUDED_TABLES.has(name));
  if (tables.length === 0) return;
  await db.query(`TRUNCATE ${tables.map((name) => `"${name}"`).join(", ")} RESTART IDENTITY CASCADE;`);
  // Groups are gone, so types created by earlier runs can go too; the built-in ones stay.
  await db.query(`DELETE FROM group_type WHERE NOT is_system;`);
}

async function insertOne<T extends Record<string, unknown>>(
  db: Queryable,
  sql: string,
  parameters: unknown[],
): Promise<T> {
  const rows = await db.query<T[]>(sql, parameters);
  const row = rows[0];
  if (!row) throw new Error(`Insert returned no row: ${sql}`);
  return row;
}

async function id(db: Queryable, sql: string, parameters: unknown[]): Promise<number> {
  return Number((await insertOne<{ id: number }>(db, sql, parameters)).id);
}

async function uuid(db: Queryable, sql: string, parameters: unknown[]): Promise<string> {
  return String((await insertOne<{ id: string }>(db, sql, parameters)).id);
}

const OFFICES = [
  { name: "President", level: 1, type: "country" },
  { name: "Governor", level: 2, type: "state" },
  { name: "Senate", level: 3, type: "senatorial_district" },
  { name: "House of Reps", level: 4, type: "federal_constituency" },
  { name: "State Assembly", level: 5, type: "state_constituency" },
] as const;

interface PuSpec {
  key: PuKey;
  code: string;
  lga: keyof TestFixture["lgaIds"];
  ward: string;
  /** Political units (by fixture key) the PU lies in, below state level. */
  units: string[];
  doubtful?: boolean;
  lat: number;
  lon: number;
}

const PUS: PuSpec[] = [
  { key: "PU-A", code: "24-10-01-001", lga: "Ikeja", ward: "Ikeja Ward 01", units: ["SD Lagos West", "FC Ikeja", "SC Ikeja I"], lat: 6.6018, lon: 3.3515 },
  { key: "PU-B", code: "24-10-01-002", lga: "Ikeja", ward: "Ikeja Ward 01", units: ["SD Lagos West", "FC Ikeja", "SC Ikeja I"], lat: 6.6031, lon: 3.3502 },
  { key: "PU-C", code: "24-10-02-001", lga: "Ikeja", ward: "Ikeja Ward 02", units: ["SD Lagos West", "FC Ikeja", "SC Ikeja II"], lat: 6.5954, lon: 3.3421 },
  // INEC's position for PU-D lies outside the Ikeja LGA outline.
  { key: "PU-D", code: "24-10-02-002", lga: "Ikeja", ward: "Ikeja Ward 02", units: ["SD Lagos West", "FC Ikeja", "SC Ikeja II"], doubtful: true, lat: 6.4541, lon: 3.3947 },
  { key: "PU-E", code: "24-12-03-001", lga: "Ikorodu", ward: "Ikorodu Ward 03", units: ["SD Lagos East", "FC Ikorodu", "SC Ikorodu I"], lat: 6.6194, lon: 3.5105 },
  { key: "PU-F", code: "22-05-01-001", lga: "Lokoja", ward: "Lokoja Ward 01", units: ["SD Kogi West", "FC Lokoja/Kogi-Koton Karfe", "SC Lokoja I"], lat: 7.8023, lon: 6.7333 },
  { key: "PU-G", code: "04-17-03-012", lga: "Awka South", ward: "Awka South Ward 03", units: ["SD Anambra Central", "FC Awka North/South", "SC Awka South I"], lat: 6.2104, lon: 7.0741 },
  // The federal constituency mapping for PU-H is missing on purpose (INEC data gap).
  { key: "PU-H", code: "20-40-01-001", lga: "Tudun Wada", ward: "Tudun Wada Ward 01", units: ["SD Kano South", "SC Tudun Wada"], lat: 11.2516, lon: 8.4062 },
];

const STATES = [
  { name: "Lagos", code: "24" },
  { name: "Kogi", code: "22" },
  { name: "Anambra", code: "04" },
  { name: "Kano", code: "20" },
] as const;

const LGAS: Array<{ name: keyof TestFixture["lgaIds"]; state: (typeof STATES)[number]["name"]; code: string }> = [
  { name: "Ikeja", state: "Lagos", code: "10" },
  { name: "Ikorodu", state: "Lagos", code: "12" },
  { name: "Lokoja", state: "Kogi", code: "05" },
  { name: "Awka South", state: "Anambra", code: "17" },
  { name: "Tudun Wada", state: "Kano", code: "40" },
];

const WARDS: Array<{ name: string; lga: keyof TestFixture["lgaIds"]; code: string }> = [
  { name: "Ikeja Ward 01", lga: "Ikeja", code: "01" },
  { name: "Ikeja Ward 02", lga: "Ikeja", code: "02" },
  { name: "Ikorodu Ward 03", lga: "Ikorodu", code: "03" },
  { name: "Lokoja Ward 01", lga: "Lokoja", code: "01" },
  { name: "Awka South Ward 03", lga: "Awka South", code: "03" },
  { name: "Tudun Wada Ward 01", lga: "Tudun Wada", code: "01" },
];

/** key → [display name, type, parent key] */
const POLITICAL_UNITS: Array<[string, string, string, string | null]> = [
  ["Nigeria", "Nigeria", "country", null],
  ["ST Lagos", "Lagos", "state", "Nigeria"],
  ["ST Kogi", "Kogi", "state", "Nigeria"],
  ["ST Anambra", "Anambra", "state", "Nigeria"],
  ["ST Kano", "Kano", "state", "Nigeria"],
  ["SD Lagos West", "Lagos West", "senatorial_district", "ST Lagos"],
  ["SD Lagos East", "Lagos East", "senatorial_district", "ST Lagos"],
  ["SD Kogi West", "Kogi West", "senatorial_district", "ST Kogi"],
  ["SD Anambra Central", "Anambra Central", "senatorial_district", "ST Anambra"],
  ["SD Kano South", "Kano South", "senatorial_district", "ST Kano"],
  ["FC Ikeja", "Ikeja", "federal_constituency", "ST Lagos"],
  ["FC Ikorodu", "Ikorodu", "federal_constituency", "ST Lagos"],
  ["FC Lokoja/Kogi-Koton Karfe", "Lokoja/Kogi-Koton Karfe", "federal_constituency", "ST Kogi"],
  ["FC Awka North/South", "Awka North/South", "federal_constituency", "ST Anambra"],
  ["SC Ikeja I", "Ikeja I", "state_constituency", "ST Lagos"],
  ["SC Ikeja II", "Ikeja II", "state_constituency", "ST Lagos"],
  ["SC Ikorodu I", "Ikorodu I", "state_constituency", "ST Lagos"],
  ["SC Lokoja I", "Lokoja I", "state_constituency", "ST Kogi"],
  ["SC Awka South I", "Awka South I", "state_constituency", "ST Anambra"],
  ["SC Tudun Wada", "Tudun Wada", "state_constituency", "ST Kano"],
];

/** key → [name, type, parent key] */
const GROUPS: Array<[string, string, string | null]> = [
  ["Collate Admins", "admin", null],
  ["NDC", "party", null],
  ["NDC Lagos", "party", "NDC"],
  ["NDC Lagos Ikeja", "party", "NDC Lagos"],
  ["NDC Kogi", "party", "NDC"],
  ["NDC Anambra", "party", "NDC"],
  ["Party Presidential Campaign", "campaign", null],
  ["Obi Presidential Campaign", "campaign", null],
  ["Obedient Movement", "support_group", null],
  ["Obedient Movement Lagos", "support_group", "Obedient Movement"],
  ["Kwankwasiyya", "support_group", null],
  ["Kwankwasiyya Kano", "support_group", "Kwankwasiyya"],
];

type Scope =
  | { state: keyof TestFixture["stateIds"] }
  | { lga: keyof TestFixture["lgaIds"] }
  | { politicalUnit: string }
  | null;

/** Users who log in (P01–P09). */
const USERS: Array<{ key: PersonaKey; name: string; group: string; role: string; scope: Scope }> = [
  { key: "P01", name: "Ada Admin", group: "Collate Admins", role: "admin_level_1", scope: null },
  { key: "P02", name: "Bayo Volunteer", group: "Collate Admins", role: "admin_level_2", scope: null },
  { key: "P03", name: "Chinedu National", group: "NDC", role: "national", scope: null },
  { key: "P04", name: "Dupe Lagos Chair", group: "NDC Lagos", role: "state_chair", scope: { state: "Lagos" } },
  { key: "P05", name: "Emeka Ikeja Coord", group: "NDC Lagos Ikeja", role: "lga_coordinator", scope: { lga: "Ikeja" } },
  { key: "P06", name: "Fatima PresCamp", group: "Party Presidential Campaign", role: "campaign_national", scope: { politicalUnit: "Nigeria" } },
  { key: "P07", name: "Gbenga ObiCamp", group: "Obi Presidential Campaign", role: "campaign_national", scope: { politicalUnit: "Nigeria" } },
  { key: "P08", name: "Halima Obedient", group: "Obedient Movement Lagos", role: "state_coordinator", scope: { state: "Lagos" } },
  { key: "P09", name: "Ibrahim Kwankwasiyya", group: "Kwankwasiyya Kano", role: "state_coordinator", scope: { state: "Kano" } },
];

/** Candidates (P10–P19). `mateOf` makes a running mate. */
const CANDIDATES: Array<{ key: PersonaKey; name: string; office?: (typeof OFFICES)[number]["name"]; unit?: string; mateOf?: PersonaKey }> = [
  { key: "P10", name: "Jide President", office: "President", unit: "Nigeria" },
  { key: "P11", name: "Kemi VicePres", mateOf: "P10" },
  { key: "P12", name: "Lola Governor", office: "Governor", unit: "ST Lagos" },
  { key: "P13", name: "Musa DepGov", mateOf: "P12" },
  { key: "P14", name: "Nafisa KanoGov", office: "Governor", unit: "ST Kano" },
  { key: "P15", name: "Obi Senate", office: "Senate", unit: "SD Lagos West" },
  { key: "P16", name: "Peju Reps", office: "House of Reps", unit: "FC Ikeja" },
  { key: "P17", name: "Queen Assembly", office: "State Assembly", unit: "SC Ikeja I" },
  { key: "P18", name: "Ray AnambraReps", office: "House of Reps", unit: "FC Awka North/South" },
  { key: "P19", name: "Sani TudunWada", office: "State Assembly", unit: "SC Tudun Wada" },
];

/** Polling-unit agents. Owners are groups unless `ownerCandidate` is set. */
const AGENTS: Array<{
  key: PersonaKey;
  name: string;
  phone: string;
  telegramChatId: number | null;
  pu: PuKey;
  kind: "official" | "extra";
  ownerGroup?: string;
  ownerCandidate?: PersonaKey;
}> = [
  { key: "P20", name: "Tunde Agent", phone: "+2348000000020", telegramChatId: 900000020, pu: "PU-A", kind: "official", ownerGroup: "NDC Lagos" },
  { key: "P21", name: "Uche Extra", phone: "+2348000000021", telegramChatId: 900000021, pu: "PU-A", kind: "extra", ownerCandidate: "P16" },
  { key: "P26", name: "Zainab Obedient Agent", phone: "+2348000000026", telegramChatId: 900000026, pu: "PU-A", kind: "extra", ownerGroup: "Obedient Movement Lagos" },
  // P22's Telegram uses another number (+2348000000122); only the listed one is on file.
  { key: "P22", name: "Victor TwoPhones", phone: "+2348000000022", telegramChatId: null, pu: "PU-C", kind: "official", ownerGroup: "NDC Lagos" },
  { key: "P24", name: "Xenia SMSOnly", phone: "+2348000000024", telegramChatId: null, pu: "PU-E", kind: "official", ownerGroup: "NDC Lagos" },
  { key: "AGENT_F", name: "Fixture Agent F", phone: "+2348000000031", telegramChatId: null, pu: "PU-F", kind: "official", ownerGroup: "NDC Kogi" },
  { key: "AGENT_G", name: "Fixture Agent G", phone: "+2348000000032", telegramChatId: null, pu: "PU-G", kind: "official", ownerGroup: "NDC Anambra" },
];

export function personaEmail(key: PersonaKey): string {
  return `${key.toLowerCase()}@fixture.collate.test`;
}

function personaPhone(key: PersonaKey): string {
  return `+23480000000${key.slice(1).padStart(2, "0")}`;
}

/**
 * Inserts the fixture into an empty database and returns the ids the tests need.
 * Run `resetTestDatabase` first.
 */
export async function seedTestFixture(db: Queryable): Promise<TestFixture> {
  // Offices.
  const officeIds = {} as TestFixture["officeIds"];
  for (const office of OFFICES) {
    officeIds[office.name] = await id(
      db,
      `INSERT INTO office (office_name, hierarchy_level, political_unit_type)
       VALUES ($1, $2, $3::political_unit_type)
       ON CONFLICT DO NOTHING
       RETURNING id;`,
      [office.name, office.level, office.type],
    ).catch(async () => {
      const rows = await db.query<Array<{ id: number }>>(`SELECT id FROM office WHERE office_name = $1;`, [office.name]);
      return Number(rows[0]?.id);
    });
  }

  // Administrative geography.
  const stateIds = {} as TestFixture["stateIds"];
  for (const state of STATES) {
    stateIds[state.name] = await id(
      db,
      `INSERT INTO state (inec_state_code, state_name) VALUES ($1, $2) RETURNING id;`,
      [state.code, state.name],
    );
  }
  const lgaIds = {} as TestFixture["lgaIds"];
  for (const lga of LGAS) {
    lgaIds[lga.name] = await id(
      db,
      `INSERT INTO lga (state_id, inec_lga_code, lga_name) VALUES ($1, $2, $3) RETURNING id;`,
      [stateIds[lga.state], lga.code, lga.name],
    );
  }
  const allWardIds: Record<string, number> = {};
  for (const ward of WARDS) {
    allWardIds[ward.name] = await id(
      db,
      `INSERT INTO ward (lga_id, inec_ward_code, ward_name) VALUES ($1, $2, $3) RETURNING id;`,
      [lgaIds[ward.lga], ward.code, ward.name],
    );
  }
  const pollingUnitIds = {} as TestFixture["pollingUnitIds"];
  for (const pu of PUS) {
    pollingUnitIds[pu.key] = await id(
      db,
      `INSERT INTO polling_unit (inec_polling_unit_code, polling_unit_name, ward_id, latitude, longitude, is_position_doubtful)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`,
      [pu.code, `${pu.key} Primary School`, allWardIds[pu.ward], pu.lat, pu.lon, pu.doubtful ?? false],
    );
  }

  // Political geography.
  const politicalUnitIds: Record<string, number> = {};
  for (const [key, name, type, parent] of POLITICAL_UNITS) {
    politicalUnitIds[key] = await id(
      db,
      `INSERT INTO political_unit (political_unit_name, political_unit_type, parent_political_unit_id)
       VALUES ($1, $2::political_unit_type, $3) RETURNING id;`,
      [name, type, parent === null ? null : politicalUnitIds[parent]],
    );
  }
  const puState: Record<PuKey, string> = {
    "PU-A": "ST Lagos", "PU-B": "ST Lagos", "PU-C": "ST Lagos", "PU-D": "ST Lagos", "PU-E": "ST Lagos",
    "PU-F": "ST Kogi", "PU-G": "ST Anambra", "PU-H": "ST Kano",
  };
  for (const pu of PUS) {
    for (const unit of ["Nigeria", puState[pu.key], ...pu.units]) {
      await db.query(
        `INSERT INTO pu_political_unit (political_unit_id, polling_unit_id) VALUES ($1, $2);`,
        [politicalUnitIds[unit], pollingUnitIds[pu.key]],
      );
    }
  }

  // The 2027 governorship day: Kogi and Anambra vote for Governor off-cycle.
  const electionDayId = await id(
    db,
    `INSERT INTO election_day (election_date, election_label) VALUES ('2027-03-06', 'Governorship and State Assembly') RETURNING id;`,
    [],
  );
  await db.query(`INSERT INTO election_day_office (election_day_id, office_id) VALUES ($1, $2);`, [
    electionDayId,
    officeIds.Governor,
  ]);
  for (const state of ["Kogi", "Anambra"] as const) {
    await db.query(`INSERT INTO election_day_off_cycle_state (election_day_id, state_id) VALUES ($1, $2);`, [
      electionDayId,
      stateIds[state],
    ]);
  }

  // Groups, with allow-all visibility (v1 default).
  const groupIds: Record<string, number> = {};
  for (const [name, type, parent] of GROUPS) {
    groupIds[name] = await id(
      db,
      // The type by its built-in key ("party", "campaign", ...); no row back = an unknown key.
      `INSERT INTO groups (group_name, group_type_id, parent_group_id)
       SELECT $1, group_type.id, $3 FROM group_type WHERE group_type.type_key = $2
       RETURNING id;`,
      [name, type, parent === null ? null : groupIds[parent]],
    );
  }
  await db.query(
    `INSERT INTO group_visibility_grant (viewer_group_id, owner_group_id, is_allowed)
     SELECT viewer.id, owner.id, TRUE FROM groups viewer CROSS JOIN groups owner;`,
  );

  const personIds = {} as TestFixture["personIds"];
  const emails: TestFixture["emails"] = {};

  async function person(key: PersonaKey, name: string, withEmail: boolean): Promise<string> {
    const email = withEmail ? personaEmail(key) : null;
    const personId = await uuid(
      db,
      `INSERT INTO person (full_name, email_address, verification_status)
       VALUES ($1, $2, 'verified') RETURNING id;`,
      [name, email],
    );
    personIds[key] = personId;
    if (email) emails[key] = email;
    return personId;
  }

  // Users with memberships.
  for (const user of USERS) {
    const personId = await person(user.key, user.name, true);
    await db.query(
      `INSERT INTO phone_number (person_id, e164_number, is_confirmed) VALUES ($1, $2, TRUE);`,
      [personId, personaPhone(user.key)],
    );
    const membershipId = await id(
      db,
      `INSERT INTO membership (person_id, group_id, membership_role) VALUES ($1, $2, $3) RETURNING id;`,
      [personId, groupIds[user.group], user.role],
    );
    if (user.scope) {
      const scope = user.scope;
      await db.query(
        `INSERT INTO membership_scope_unit (membership_id, scope_state_id, scope_lga_id, scope_ward_id, scope_political_unit_id)
         VALUES ($1, $2, $3, NULL, $4);`,
        [
          membershipId,
          "state" in scope ? stateIds[scope.state] : null,
          "lga" in scope ? lgaIds[scope.lga] : null,
          "politicalUnit" in scope ? politicalUnitIds[scope.politicalUnit] : null,
        ],
      );
    }
  }

  // Candidates and running mates.
  const candidateIds: TestFixture["candidateIds"] = {};
  const seatIds: TestFixture["seatIds"] = {};
  for (const candidate of CANDIDATES) {
    const personId = await person(candidate.key, candidate.name, true);
    await db.query(
      `INSERT INTO phone_number (person_id, e164_number, is_confirmed) VALUES ($1, $2, TRUE);`,
      [personId, personaPhone(candidate.key)],
    );
    if (candidate.mateOf) {
      candidateIds[candidate.key] = await id(
        db,
        `INSERT INTO candidate (person_id, principal_candidate_id) VALUES ($1, $2) RETURNING id;`,
        [personId, candidateIds[candidate.mateOf]],
      );
      seatIds[candidate.key] = seatIds[candidate.mateOf];
      continue;
    }
    const seatId = await id(
      db,
      `INSERT INTO seat (office_id, political_unit_id) VALUES ($1, $2) RETURNING id;`,
      [officeIds[candidate.office as keyof TestFixture["officeIds"]], politicalUnitIds[candidate.unit as string]],
    );
    seatIds[candidate.key] = seatId;
    candidateIds[candidate.key] = await id(
      db,
      `INSERT INTO candidate (person_id, seat_id) VALUES ($1, $2) RETURNING id;`,
      [personId, seatId],
    );
  }

  // Agents.
  const extraSlots = new Map<string, number>();
  for (const agent of AGENTS) {
    const personId = await person(agent.key, agent.name, false);
    await db.query(
      `INSERT INTO phone_number (person_id, e164_number, is_confirmed, telegram_chat_id) VALUES ($1, $2, TRUE, $3);`,
      [personId, agent.phone, agent.telegramChatId],
    );
    if (agent.telegramChatId !== null) {
      await db.query(
        `INSERT INTO consent (person_id, consent_text_version, is_accepted) VALUES ($1, 'v1', TRUE);`,
        [personId],
      );
    }
    const ownerKey = `${agent.pu}|${agent.ownerGroup ?? agent.ownerCandidate}`;
    const slot = agent.kind === "official" ? 0 : (extraSlots.get(ownerKey) ?? 0) + 1;
    if (agent.kind === "extra") extraSlots.set(ownerKey, slot);
    await db.query(
      `INSERT INTO agent_assignment (person_id, polling_unit_id, owner_group_id, owner_candidate_id, agent_kind, slot_number)
       VALUES ($1, $2, $3, $4, $5::agent_kind, $6);`,
      [
        personId,
        pollingUnitIds[agent.pu],
        agent.ownerGroup ? groupIds[agent.ownerGroup] : null,
        agent.ownerCandidate ? candidateIds[agent.ownerCandidate] : null,
        agent.kind,
        slot,
      ],
    );
  }

  return {
    personIds,
    emails,
    candidateIds,
    seatIds,
    pollingUnitIds,
    stateIds,
    lgaIds,
    wardIds: {
      "Ikeja Ward 01": allWardIds["Ikeja Ward 01"],
      "Ikeja Ward 02": allWardIds["Ikeja Ward 02"],
    },
    politicalUnitIds,
    groupIds,
    officeIds,
  };
}
