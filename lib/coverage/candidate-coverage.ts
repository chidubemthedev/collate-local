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
  const geo = query.geoSql;

  const sql = `
    WITH unit_totals AS MATERIALIZED (
      SELECT ppu.political_unit_id AS unit_id, COUNT(*) AS total_pus
      FROM pu_political_unit ppu
      JOIN polling_unit pu ON pu.id = ppu.polling_unit_id
      JOIN ward w ON w.id = pu.ward_id
      JOIN lga l ON l.id = w.lga_id
      JOIN state s ON s.id = l.state_id
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
      ORDER BY o.hierarchy_level, c.id
      LIMIT ${limitParam}::int
    ),
    office_counts AS (
      SELECT o.id, o.office_name, o.hierarchy_level, COUNT(*) AS races
      FROM candidate c
      JOIN seat st ON st.id = c.seat_id
      JOIN office o ON o.id = st.office_id
      JOIN unit_totals ut ON ut.unit_id = st.political_unit_id
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
      (
        SELECT COUNT(DISTINCT pu.id)
        FROM agent_assignment aa
        JOIN pu_political_unit ppu ON ppu.polling_unit_id = aa.polling_unit_id
          AND ppu.political_unit_id = page.unit_id
        JOIN polling_unit pu ON pu.id = aa.polling_unit_id
        JOIN ward w ON w.id = pu.ward_id
        JOIN lga l ON l.id = w.lga_id
        JOIN state s ON s.id = l.state_id
        WHERE aa.agent_kind = 'official' AND ${geo}
      ) AS covered_pus,
      (
        SELECT COUNT(DISTINCT aa.id)
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
