import type { DataSource } from "typeorm";
import { maskPhoneNumber } from "@/lib/policy/core/list-agents";

export const CANDIDATE_COVERAGE_MAX_LIMIT = 500;

export type CandidateChannelStatus = "connected" | "sms_only" | "not_matched";

export interface CandidateCoverageItem {
  id: number;
  office: string;
  hierarchyLevel: number;
  seat: string;
  stateId: number | null;
  inecStateCode: string | null;
  name: string;
  deputyName: string | null;
  maskedPhone: string | null;
  channelStatus: CandidateChannelStatus;
  isOffCycle: boolean;
  totalPUs: number;
  coveredPUs: number;
  coveragePct: number;
  extraAgentsCount: number;
}

export interface CandidateOfficeOption {
  id: number;
  name: string;
  hierarchyLevel: number;
  count: number;
}

export interface CandidateCoveragePage {
  items: CandidateCoverageItem[];
  nextCursor: string | null;
  total: number;
  offices: CandidateOfficeOption[] | null;
}

export interface CandidateCoverageQuery {
  dataSource: DataSource;
  actorPersonId: string;
  ipAddress: string | null;
  geoSql: string;
  geoParameters: unknown[];
  firstFreeParameter: number;
  limit: number;
  cursor: string | null;
  officeId: number | null;
  /** Only national (country-level) seats, e.g. President when viewing all of Nigeria. */
  nationalOnly?: boolean;
  /**
   * Only seats whose area overlaps this state / LGA / ward, even partly. Unlike the geo filter,
   * this does not clip coverage: totals still cover the whole seat (within the user's scope).
   */
  overlap?: { stateId: number | null; lgaId: number | null; wardId: number | null };
}

interface Row {
  id: number;
  office_name: string;
  hierarchy_level: number;
  seat_name: string;
  state_id: number | null;
  inec_state_code: string | null;
  full_name: string;
  deputy_name: string | null;
  phone_e164: string | null;
  has_telegram: boolean;
  is_off_cycle: boolean;
  total_pus: string;
  covered_pus: string;
  extra_agents: string;
}

/** Seats whose unit has a polling unit in the given state / LGA / ward (all NULL = no filter). */
function buildOverlapSql(unitColumn: string, stateParam: string, lgaParam: string, wardParam: string): string {
  return `(
    (${stateParam}::int IS NULL AND ${lgaParam}::int IS NULL AND ${wardParam}::int IS NULL)
    OR EXISTS (
      SELECT 1
      FROM pu_political_unit ov_ppu
      JOIN polling_unit ov_pu ON ov_pu.id = ov_ppu.polling_unit_id
      JOIN ward ov_w ON ov_w.id = ov_pu.ward_id
      JOIN lga ov_l ON ov_l.id = ov_w.lga_id
      WHERE ov_ppu.political_unit_id = ${unitColumn}
        AND (${stateParam}::int IS NULL OR ov_l.state_id = ${stateParam}::int)
        AND (${lgaParam}::int IS NULL OR ov_l.id = ${lgaParam}::int)
        AND (${wardParam}::int IS NULL OR ov_w.id = ${wardParam}::int)
    )
  )`;
}

export type CandidateCountQuery = Pick<
  CandidateCoverageQuery,
  "dataSource" | "geoSql" | "geoParameters" | "firstFreeParameter" | "officeId" | "nationalOnly" | "overlap"
>;

/**
 * How many candidates the list would hold, without working out anyone's coverage.
 * Same rules as listCandidateCoverage: a seat counts when it has a polling unit in the
 * user's scope (and, if asked, overlaps the area). Running mates have no seat of their own.
 */
export async function countCandidates(query: CandidateCountQuery): Promise<number> {
  const officeParam = `$${query.firstFreeParameter}`;
  const nationalParam = `$${query.firstFreeParameter + 1}`;
  const stateParam = `$${query.firstFreeParameter + 2}`;
  const lgaParam = `$${query.firstFreeParameter + 3}`;
  const wardParam = `$${query.firstFreeParameter + 4}`;

  const rows = await query.dataSource.query<Array<{ total: number | string }>>(
    `
      SELECT COUNT(*)::int AS total
      FROM candidate c
      JOIN seat st ON st.id = c.seat_id
      JOIN political_unit pun ON pun.id = st.political_unit_id
      WHERE (${officeParam}::int IS NULL OR st.office_id = ${officeParam}::int)
        AND (${nationalParam}::boolean IS NOT TRUE OR pun.political_unit_type = 'country')
        AND EXISTS (
          SELECT 1
          FROM pu_political_unit ppu
          JOIN polling_unit pu ON pu.id = ppu.polling_unit_id
          JOIN ward w ON w.id = pu.ward_id
          JOIN lga l ON l.id = w.lga_id
          JOIN state s ON s.id = l.state_id
          WHERE ppu.political_unit_id = pun.id AND ${query.geoSql}
        )
        AND ${buildOverlapSql("pun.id", stateParam, lgaParam, wardParam)};
    `,
    [
      ...query.geoParameters,
      query.officeId,
      query.nationalOnly ?? false,
      query.overlap?.stateId ?? null,
      query.overlap?.lgaId ?? null,
      query.overlap?.wardId ?? null,
    ],
  );
  return Number(rows[0]?.total ?? 0);
}

export function decodeCandidateCoverageCursor(
  cursor: string,
): { level: number; id: number } | null {
  const match = /^(\d{1,9})\.(\d{1,9})$/.exec(cursor);
  if (!match) return null;
  return { level: Number(match[1]), id: Number(match[2]) };
}

export async function listCandidateCoverage(query: CandidateCoverageQuery): Promise<CandidateCoveragePage> {
  const decoded = query.cursor ? decodeCandidateCoverageCursor(query.cursor) : null;
  const levelParam = `$${query.firstFreeParameter}`;
  const idParam = `$${query.firstFreeParameter + 1}`;
  const limitParam = `$${query.firstFreeParameter + 2}`;
  const officeParam = `$${query.firstFreeParameter + 3}`;
  const nationalParam = `$${query.firstFreeParameter + 4}`;
  const overlapStateParam = `$${query.firstFreeParameter + 5}`;
  const overlapLgaParam = `$${query.firstFreeParameter + 6}`;
  const overlapWardParam = `$${query.firstFreeParameter + 7}`;
  const geo = query.geoSql;
  const overlapSql = (unitColumn: string) =>
    buildOverlapSql(unitColumn, overlapStateParam, overlapLgaParam, overlapWardParam);

  const sql = `
    WITH unit_totals AS MATERIALIZED (
      -- Covered units are counted in the same pass: a polling unit has at most one official agent,
      -- so the join adds no rows. (Counting them per page row instead ran one scan per candidate.)
      SELECT
        ppu.political_unit_id AS unit_id,
        COUNT(*) AS total_pus,
        COUNT(official.polling_unit_id) AS covered_pus
      FROM pu_political_unit ppu
      JOIN polling_unit pu ON pu.id = ppu.polling_unit_id
      JOIN ward w ON w.id = pu.ward_id
      JOIN lga l ON l.id = w.lga_id
      JOIN state s ON s.id = l.state_id
      LEFT JOIN agent_assignment official
        ON official.polling_unit_id = pu.id AND official.agent_kind = 'official'
      WHERE ${geo}
      GROUP BY ppu.political_unit_id
    ),
    page AS MATERIALIZED (
      SELECT
        c.id,
        c.person_id,
        o.id AS office_id,
        o.office_name,
        o.hierarchy_level,
        pun.id AS unit_id,
        pun.political_unit_name AS seat_name,
        ut.total_pus,
        ut.covered_pus,
        seat_state.id AS state_id,
        seat_state.inec_state_code
      FROM candidate c
      JOIN seat st ON st.id = c.seat_id
      JOIN office o ON o.id = st.office_id
      JOIN political_unit pun ON pun.id = st.political_unit_id
      JOIN unit_totals ut ON ut.unit_id = pun.id
      LEFT JOIN LATERAL (
        SELECT s2.id, s2.inec_state_code
        FROM pu_political_unit ppu2
        JOIN polling_unit pu2 ON pu2.id = ppu2.polling_unit_id
        JOIN ward w2 ON w2.id = pu2.ward_id
        JOIN lga l2 ON l2.id = w2.lga_id
        JOIN state s2 ON s2.id = l2.state_id
        WHERE ppu2.political_unit_id = pun.id AND pun.political_unit_type <> 'country'
        LIMIT 1
      ) seat_state ON TRUE
      WHERE (${levelParam}::int IS NULL OR (o.hierarchy_level, c.id) > (${levelParam}::int, ${idParam}::int))
        AND (${officeParam}::int IS NULL OR o.id = ${officeParam}::int)
        AND (${nationalParam}::boolean IS NOT TRUE OR pun.political_unit_type = 'country')
        AND ${overlapSql("pun.id")}
      ORDER BY o.hierarchy_level, c.id
      LIMIT ${limitParam}::int
    ),
    office_counts AS (
      SELECT o.id, o.office_name, o.hierarchy_level, COUNT(*) AS races
      FROM candidate c
      JOIN seat st ON st.id = c.seat_id
      JOIN office o ON o.id = st.office_id
      JOIN unit_totals ut ON ut.unit_id = st.political_unit_id
      JOIN political_unit oc_pun ON oc_pun.id = st.political_unit_id
      WHERE (${nationalParam}::boolean IS NOT TRUE OR oc_pun.political_unit_type = 'country')
        AND ${overlapSql("oc_pun.id")}
      GROUP BY o.id, o.office_name, o.hierarchy_level
    )
    SELECT
      (
        SELECT COALESCE(json_agg(r ORDER BY r.hierarchy_level, r.id), '[]'::json)
        FROM (
    SELECT
      page.id,
      page.office_name,
      page.hierarchy_level,
      page.seat_name,
      page.state_id,
      page.inec_state_code,
      person.full_name,
      (
        SELECT ph.e164_number
        FROM phone_number ph
        WHERE ph.person_id = page.person_id
        ORDER BY (ph.telegram_chat_id IS NOT NULL) DESC, ph.is_confirmed DESC, ph.e164_number
        LIMIT 1
      ) AS phone_e164,
      EXISTS (
        SELECT 1 FROM phone_number ph
        WHERE ph.person_id = page.person_id AND ph.telegram_chat_id IS NOT NULL
      ) AS has_telegram,
      (
        page.state_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM election_day_office edo
          JOIN election_day_off_cycle_state oc ON oc.election_day_id = edo.election_day_id
          WHERE edo.office_id = page.office_id
            AND oc.state_id = page.state_id
            AND edo.election_day_id = (SELECT id FROM election_day ORDER BY election_date DESC LIMIT 1)
        )
      ) AS is_off_cycle,
      (
        SELECT mate_person.full_name
        FROM candidate mate
        JOIN person mate_person ON mate_person.id = mate.person_id
        WHERE mate.principal_candidate_id = page.id
        ORDER BY mate.id
        LIMIT 1
      ) AS deputy_name,
      page.total_pus,
      page.covered_pus,
      (
        -- One row per assignment (each join below matches at most one row), so no DISTINCT.
        SELECT COUNT(*)
        FROM agent_assignment aa
        JOIN pu_political_unit ppu ON ppu.polling_unit_id = aa.polling_unit_id
          AND ppu.political_unit_id = page.unit_id
        JOIN polling_unit pu ON pu.id = aa.polling_unit_id
        JOIN ward w ON w.id = pu.ward_id
        JOIN lga l ON l.id = w.lga_id
        JOIN state s ON s.id = l.state_id
        WHERE aa.owner_candidate_id = page.id AND aa.agent_kind = 'extra' AND ${geo}
      ) AS extra_agents
    FROM page
    JOIN person ON person.id = page.person_id
        ) r
      ) AS rows,
      (
        SELECT COALESCE(json_agg(oc ORDER BY oc.hierarchy_level, oc.id), '[]'::json)
        FROM office_counts oc
      ) AS offices;
  `;

  // One round trip fetches the page and the per-office counts. The counts serve both
  // the filtered total and the office dropdown (which ignores the office filter).
  const result = await query.dataSource.query<
    Array<{
      rows: Row[];
      offices: Array<{ id: number; office_name: string; hierarchy_level: number; races: string | number }>;
    }>
  >(sql, [
    ...query.geoParameters,
    decoded?.level ?? null,
    decoded?.id ?? null,
    query.limit + 1,
    query.officeId,
    query.nationalOnly ?? false,
    query.overlap?.stateId ?? null,
    query.overlap?.lgaId ?? null,
    query.overlap?.wardId ?? null,
  ]);

  const rows = result[0]?.rows ?? [];
  const officeOptions: CandidateOfficeOption[] = (result[0]?.offices ?? []).map((row) => ({
    id: row.id,
    name: row.office_name,
    hierarchyLevel: row.hierarchy_level,
    count: Number(row.races),
  }));

  const pageRows = rows.slice(0, query.limit);
  const hasMore = rows.length > query.limit;
  const last = pageRows[pageRows.length - 1];

  await query.dataSource.query(
    `INSERT INTO audit_log (actor_person_id, action_type, target_entity_type, target_entity_id, ip_address)
     VALUES ($1, $2, $3, $4, $5);`,
    [
      query.actorPersonId,
      "view_candidate_coverage",
      pageRows.length > 0 ? "candidate" : null,
      pageRows.length > 0 ? pageRows.map((row) => row.id).join(",").slice(0, 250) : null,
      query.ipAddress,
    ],
  );

  const total = officeOptions
    .filter((office) => query.officeId === null || office.id === query.officeId)
    .reduce((sum, office) => sum + office.count, 0);
  const offices: CandidateOfficeOption[] | null = decoded ? null : officeOptions;

  const items = pageRows.map((row): CandidateCoverageItem => {
    const totalPUs = Number(row.total_pus);
    const coveredPUs = Number(row.covered_pus);
    return {
      id: row.id,
      office: row.office_name,
      hierarchyLevel: row.hierarchy_level,
      seat: row.seat_name,
      stateId: row.state_id,
      inecStateCode: row.inec_state_code,
      name: row.full_name,
      deputyName: row.deputy_name,
      maskedPhone: maskPhoneNumber(row.phone_e164),
      channelStatus: row.has_telegram ? "connected" : row.phone_e164 ? "sms_only" : "not_matched",
      isOffCycle: row.is_off_cycle,
      totalPUs,
      coveredPUs,
      coveragePct: totalPUs > 0 ? Math.round((coveredPUs / totalPUs) * 100) : 0,
      extraAgentsCount: Number(row.extra_agents),
    };
  });

  return {
    items,
    nextCursor: hasMore && last ? `${last.hierarchy_level}.${last.id}` : null,
    total,
    offices,
  };
}
