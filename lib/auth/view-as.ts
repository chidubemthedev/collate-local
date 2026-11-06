/**
 * "View as": preview the app with narrower access than your own.
 *
 * Choices are levels and seats at or below the person's own access:
 *   - Admin: Party · National, Admin, Candidate · President and every seat;
 *   - Party (national): Party · National, Candidate · President and every seat;
 *   - anyone limited to an area (a state, LGA, ward or constituency): only the seats lying
 *     entirely inside that area, e.g. a Senate user sees their district and the Reps and
 *     Assembly seats within it.
 * A view only ever narrows access, and while one is on the app is read-only.
 *
 * Free of server-only imports so it can be tested directly.
 */
import type { MembershipScope } from "./coverage-scope";
import type { PolicyUser } from "../policy/core/policy-user";

export interface Queryable {
  query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T>;
}

/** What a person can see on their own, before any "View as". */
export interface OwnAccess {
  isAdmin: boolean;
  hasGlobalCoverageAccess: boolean;
  scopes: MembershipScope[];
}

/** Kept on the session (auth_session.view_as). Seat details are stored so most requests need no lookup. */
export type StoredViewAs =
  | { kind: "party" }
  | { kind: "seat"; seatId: number; unitId: number; unitType: string; label: string };

/** The access to use while a view is on. */
export interface EffectiveAccess {
  label: string;
  hasGlobalCoverageAccess: boolean;
  scopes: MembershipScope[];
  /** The seat being previewed (agents and broadcasts use it to scope their lists). */
  seatId: number | null;
}

export interface ViewAsOption {
  /** "party", "admin", "self" or "seat:<id>". */
  value: string;
  label: string;
}

export interface ViewAsGroup {
  /** Null for single entries (Party · National, Admin, Candidate · President). */
  heading: string | null;
  options: ViewAsOption[];
}

export const PARTY_LABEL = "Party · National";
export const ADMIN_LABEL = "Admin";

const OFFICE_ORDER = ["President", "Governor", "Senate", "House of Reps", "State Assembly"];

type SeatRow = {
  seat_id: number;
  office_name: string;
  unit_id: number;
  unit_name: string;
  unit_type: string;
};

/** INEC names arrive in capitals; show them in title case ("FCT" stays as is). */
export function titleCaseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s\-'(/])([a-z])/g, (_, separator: string, letter: string) => separator + letter.toUpperCase())
    .replace(/\bFct\b/g, "FCT");
}

export function seatLabel(officeName: string, unitName: string): string {
  return officeName === "President"
    ? "Candidate · President"
    : `Candidate · ${officeName}, ${titleCaseName(unitName)}`;
}

export type MembershipAccessRow = {
  group_name: string | null;
  group_type: string | null;
  scope_state_id: number | null;
  scope_lga_id: number | null;
  scope_ward_id: number | null;
  scope_political_unit_id: number | null;
};

/** The person's own access and its label (their group names), from their membership rows. */
export function ownAccessFromRows(rows: MembershipAccessRow[]): { own: OwnAccess; label: string } {
  const memberships = rows.filter((row) => row.group_type !== null);
  const isAdmin = memberships.some((row) => row.group_type === "admin");
  const names = [...new Set(memberships.map((row) => row.group_name).filter((name): name is string => !!name))];
  return {
    own: {
      isAdmin,
      // Admins, and party memberships with no area (one row of NULL areas), see the whole country.
      // A party membership with an area sees only that area, as in the agents and broadcasts rules.
      hasGlobalCoverageAccess: memberships.some(
        (row) =>
          row.group_type === "admin" ||
          (row.group_type === "party" &&
            row.scope_state_id === null &&
            row.scope_lga_id === null &&
            row.scope_ward_id === null &&
            row.scope_political_unit_id === null),
      ),
      scopes: memberships
        .filter(
          (row) =>
            row.scope_state_id !== null ||
            row.scope_lga_id !== null ||
            row.scope_ward_id !== null ||
            row.scope_political_unit_id !== null,
        )
        .map((row) => ({
          stateId: row.scope_state_id,
          lgaId: row.scope_lga_id,
          wardId: row.scope_ward_id,
          politicalUnitId: row.scope_political_unit_id,
        })),
    },
    label: names.length ? names.join(", ") : isAdmin ? ADMIN_LABEL : "Account",
  };
}

/** Loads a person's own access (used where the session query did not already read it). */
export async function loadOwnAccess(db: Queryable, personId: string): Promise<{ own: OwnAccess; label: string }> {
  const rows = await db.query<MembershipAccessRow[]>(
    `
      SELECT g.group_name, g.group_type, ms.scope_state_id, ms.scope_lga_id, ms.scope_ward_id,
        ms.scope_political_unit_id
      FROM membership m
      JOIN groups g ON g.id = m.group_id
      LEFT JOIN membership_scope_unit ms ON ms.membership_id = m.id
      WHERE m.person_id = $1;
    `,
    [personId],
  );
  return ownAccessFromRows(rows);
}

/**
 * The agents/broadcasts user for a view: the previewed seat stands in for the person's own
 * groups and areas, with the seat's candidate (if there is one) so candidate-only rules apply.
 * Party · National gets what a party account gets there: every polling unit, no admin rights.
 */
export async function policyUserForView(
  db: Queryable,
  personId: string,
  view: EffectiveAccess,
): Promise<PolicyUser> {
  const empty = { stateIds: [], lgaIds: [], wardIds: [], politicalUnitIds: [] };
  if (view.seatId === null) {
    return {
      personId,
      isAdmin: false,
      hasNationalAccess: true,
      candidateId: null,
      seatId: null,
      groupIds: [],
      scopeUnits: empty,
    };
  }
  const [candidate] = await db.query<Array<{ id: number }>>(
    `SELECT id FROM candidate WHERE seat_id = $1 ORDER BY id LIMIT 1;`,
    [view.seatId],
  );
  return {
    personId,
    isAdmin: false,
    candidateId: candidate ? Number(candidate.id) : null,
    seatId: view.seatId,
    groupIds: [],
    scopeUnits: empty,
  };
}

/** The value the person's own access has in the list: Admin, Party · National, or "self". */
export function ownValue(own: OwnAccess): string {
  if (own.isAdmin) return "admin";
  if (own.hasGlobalCoverageAccess) return "party";
  return "self";
}

/**
 * SQL for the polling units inside a set of areas, one simple lookup per kind of area, joined
 * with UNION (a per-row check against every polling unit is far slower). `parameter` adds a
 * query parameter and returns its placeholder. Empty when there are no areas.
 */
function areaUnitsSql(scopes: MembershipScope[], parameter: (value: unknown) => string): string[] {
  const ids = (key: keyof MembershipScope) =>
    [...new Set(scopes.flatMap((scope) => (scope[key] === null ? [] : [scope[key] as number])))];
  const sources: string[] = [];
  const stateIds = ids("stateId");
  const lgaIds = ids("lgaId");
  const wardIds = ids("wardId");
  const unitIds = ids("politicalUnitId");
  if (stateIds.length) {
    sources.push(`SELECT pu.id FROM polling_unit pu JOIN ward w ON w.id = pu.ward_id
        JOIN lga l ON l.id = w.lga_id WHERE l.state_id = ANY(${parameter(stateIds)}::int[])`);
  }
  if (lgaIds.length) {
    sources.push(`SELECT pu.id FROM polling_unit pu JOIN ward w ON w.id = pu.ward_id
        WHERE w.lga_id = ANY(${parameter(lgaIds)}::int[])`);
  }
  if (wardIds.length) {
    sources.push(`SELECT pu.id FROM polling_unit pu WHERE pu.ward_id = ANY(${parameter(wardIds)}::int[])`);
  }
  if (unitIds.length) {
    sources.push(`SELECT ppu.polling_unit_id AS id FROM pu_political_unit ppu
        WHERE ppu.political_unit_id = ANY(${parameter(unitIds)}::int[])`);
  }
  return sources;
}

/** INEC codes of the smallest state / LGA / ward holding all of an access, for the area filters. */
export interface HomeArea {
  stateCode: string | null;
  lgaCode: string | null;
  wardCode: string | null;
}

/**
 * Where an access sits: its state if it lies in one state, its LGA if in one LGA, its ward if in
 * one ward. Null for national access (and for access with no areas).
 */
export async function loadHomeArea(
  db: Queryable,
  access: { hasGlobalCoverageAccess: boolean; scopes: MembershipScope[] },
): Promise<HomeArea | null> {
  if (access.hasGlobalCoverageAccess) return null;
  const parameters: unknown[] = [];
  const sources = areaUnitsSql(access.scopes, (value) => {
    parameters.push(value);
    return `$${parameters.length}`;
  });
  if (!sources.length) return null;

  const [row] = await db.query<Array<{
    states: string;
    state_code: string | null;
    lgas: string;
    lga_code: string | null;
    wards: string;
    ward_code: string | null;
  }>>(
    `
      WITH units AS (
        ${sources.join("\n        UNION\n        ")}
      )
      SELECT
        COUNT(DISTINCT s.id) AS states, MIN(s.inec_state_code) AS state_code,
        COUNT(DISTINCT l.id) AS lgas, MIN(l.inec_lga_code) AS lga_code,
        COUNT(DISTINCT w.id) AS wards, MIN(w.inec_ward_code) AS ward_code
      FROM units
      JOIN polling_unit pu ON pu.id = units.id
      JOIN ward w ON w.id = pu.ward_id
      JOIN lga l ON l.id = w.lga_id
      JOIN state s ON s.id = l.state_id;
    `,
    parameters,
  );
  if (!row || Number(row.states) !== 1) return null;
  const oneLga = Number(row.lgas) === 1;
  return {
    stateCode: row.state_code,
    lgaCode: oneLga ? row.lga_code : null,
    wardCode: oneLga && Number(row.wards) === 1 ? row.ward_code : null,
  };
}

/**
 * Seats the person may view as: every seat for national access, otherwise seats whose
 * polling units all lie inside the person's area. `seatId` limits the check to one seat.
 */
async function loadAllowedSeats(db: Queryable, own: OwnAccess, seatId?: number): Promise<SeatRow[]> {
  const global = own.isAdmin || own.hasGlobalCoverageAccess;
  const parameters: unknown[] = [];
  const parameter = (value: unknown) => {
    parameters.push(value);
    return `$${parameters.length}`;
  };

  // The person's own polling units.
  const ownSources = global ? [] : areaUnitsSql(own.scopes, parameter);
  if (!global && !ownSources.length) return [];
  const seatParameter = seatId !== undefined ? parameter(seatId) : "";

  // Area-limited: start from the person's own polling units, count how many of each seat's
  // polling units they cover, and keep the seats they cover completely. Only seats that overlap
  // the area are looked at (a state lead: ~2.4 s checking every seat -> well under 0.1 s).
  const insideCte = global
    ? ""
    : `WITH own_units AS (
         ${ownSources.join("\n         UNION\n         ")}
       ),
       covered AS (
         SELECT ppu.political_unit_id AS unit_id, COUNT(*) AS inside
         FROM pu_political_unit ppu
         JOIN own_units ON own_units.id = ppu.polling_unit_id
         GROUP BY ppu.political_unit_id
       )`;
  const inside = global
    ? "TRUE"
    : `pun.id IN (
         SELECT covered.unit_id
         FROM covered
         WHERE covered.inside = (
           SELECT COUNT(*) FROM pu_political_unit every_pu WHERE every_pu.political_unit_id = covered.unit_id
         )
       )`;

  return db.query<SeatRow[]>(
    `
      ${insideCte}
      SELECT
        st.id AS seat_id,
        o.office_name,
        pun.id AS unit_id,
        pun.political_unit_name AS unit_name,
        pun.political_unit_type::text AS unit_type
      FROM seat st
      JOIN office o ON o.id = st.office_id
      JOIN political_unit pun ON pun.id = st.political_unit_id
      WHERE ${seatId !== undefined ? `st.id = ${seatParameter} AND ` : ""}${inside}
      ORDER BY o.hierarchy_level, pun.political_unit_name;
    `,
    parameters,
  );
}

/**
 * Political units (seats' areas) lying entirely inside an access, or null for national access.
 * Lists of seats use it so access only reaches downward: a Governor's view lists the Governor,
 * Senate, Reps and Assembly seats in the state, but not the President.
 */
export async function loadUnitsWithin(
  db: Queryable,
  access: { hasGlobalCoverageAccess: boolean; scopes: MembershipScope[] },
): Promise<number[] | null> {
  if (access.hasGlobalCoverageAccess) return null;
  const seats = await loadAllowedSeats(db, { isAdmin: false, hasGlobalCoverageAccess: false, scopes: access.scopes });
  return [...new Set(seats.map((seat) => Number(seat.unit_id)))];
}

/** The list for the "View as" dropdown, grouped as Party/Admin/President, then each seat level. */
export async function listViewAsOptions(
  db: Queryable,
  own: OwnAccess,
  ownLabel: string,
): Promise<{ self: ViewAsOption; groups: ViewAsGroup[] }> {
  const seats = await loadAllowedSeats(db, own);
  const global = own.isAdmin || own.hasGlobalCoverageAccess;
  const singles: ViewAsOption[] = [];
  if (global) singles.push({ value: "party", label: PARTY_LABEL });
  if (own.isAdmin) singles.push({ value: "admin", label: ADMIN_LABEL });

  const byOffice = new Map<string, ViewAsOption[]>();
  for (const seat of seats) {
    const option = { value: `seat:${seat.seat_id}`, label: seatLabel(seat.office_name, seat.unit_name) };
    if (seat.office_name === "President") {
      singles.push(option);
      continue;
    }
    if (!byOffice.has(seat.office_name)) byOffice.set(seat.office_name, []);
    byOffice.get(seat.office_name)!.push({ value: option.value, label: titleCaseName(seat.unit_name) });
  }

  const offices = [...byOffice.keys()].sort(
    (a, b) => (OFFICE_ORDER.indexOf(a) + 1 || 99) - (OFFICE_ORDER.indexOf(b) + 1 || 99),
  );
  const self = global
    ? singles.find((option) => option.value === ownValue(own))!
    : { value: "self", label: ownLabel };

  return {
    self,
    groups: [
      // People limited to an area start with their own access, so they can always go back to it.
      ...(global ? [] : [{ heading: null, options: [self] }]),
      ...(singles.length ? [{ heading: null, options: singles }] : []),
      ...offices.map((office) => ({
        heading: `Candidate · ${office}`,
        options: byOffice.get(office)!,
      })),
    ],
  };
}

/**
 * Checks a choice against the person's own access. Returns what to store on the session, null to
 * go back to their own access (they picked themselves), or "forbidden".
 */
export async function chooseViewAs(
  db: Queryable,
  own: OwnAccess,
  value: string,
): Promise<StoredViewAs | null | "forbidden"> {
  if (value === "self" || value === ownValue(own)) return null;
  if (value === "admin") return own.isAdmin ? null : "forbidden";
  if (value === "party") {
    return own.isAdmin || own.hasGlobalCoverageAccess ? { kind: "party" } : "forbidden";
  }
  const match = /^seat:(\d+)$/.exec(value);
  if (!match) return "forbidden";
  const [seat] = await loadAllowedSeats(db, own, Number(match[1]));
  if (!seat) return "forbidden";
  return {
    kind: "seat",
    seatId: seat.seat_id,
    unitId: seat.unit_id,
    unitType: seat.unit_type,
    label: seatLabel(seat.office_name, seat.unit_name),
  };
}

/**
 * The access a stored view gives, or null if it is no longer allowed (the person's own access
 * shrank since they chose it). National access may view anything, so only area-limited people
 * are re-checked, with one small query.
 */
export async function effectiveAccess(
  db: Queryable,
  own: OwnAccess,
  stored: unknown,
): Promise<EffectiveAccess | null> {
  const view = stored as Partial<StoredViewAs> | null;
  if (!view || typeof view !== "object") return null;
  const global = own.isAdmin || own.hasGlobalCoverageAccess;

  if (view.kind === "party") {
    return global ? { label: PARTY_LABEL, hasGlobalCoverageAccess: true, scopes: [], seatId: null } : null;
  }
  if (view.kind === "seat" && typeof view.seatId === "number" && typeof view.unitId === "number") {
    if (!global) {
      const [seat] = await loadAllowedSeats(db, own, view.seatId);
      if (!seat) return null;
    }
    // The President's constituency is the whole country.
    const national = view.unitType === "country";
    return {
      label: typeof view.label === "string" ? view.label : "Candidate",
      hasGlobalCoverageAccess: national,
      scopes: national ? [] : [{ stateId: null, lgaId: null, wardId: null, politicalUnitId: view.unitId }],
      seatId: view.seatId,
    };
  }
  return null;
}
