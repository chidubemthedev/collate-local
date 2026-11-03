import type { DataSource } from "typeorm";

export const CANDIDATE_COVERAGE_MAX_LIMIT = 100;

export interface CandidateCoverageItem {
  id: number;
  office: string;
  hierarchyLevel: number;
  seat: string;
  name: string;
  deputyName: string | null;
  totalPUs: number;
  coveredPUs: number;
  coveragePct: number;
  extraAgentsCount: number;
}

export interface CandidateCoveragePage {
  items: CandidateCoverageItem[];
  nextCursor: string | null;
  total: number;
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
}

interface Row {
  id: number;
  office_name: string;
  hierarchy_level: number;
  seat_name: string;
  full_name: string;
  deputy_name: string | null;
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
  const geo = query.geoSql;

  const sql = `
    WITH page AS (
      SELECT
        c.id,
        c.person_id,
        o.office_name,
        o.hierarchy_level,
        pun.id AS unit_id,
        pun.political_unit_name AS seat_name
      FROM candidate c
      JOIN seat st ON st.id = c.seat_id
      JOIN office o ON o.id = st.office_id
      JOIN political_unit pun ON pun.id = st.political_unit_id
      WHERE (${levelParam}::int IS NULL OR (o.hierarchy_level, c.id) > (${levelParam}::int, ${idParam}::int))
        AND EXISTS (
          SELECT 1
          FROM pu_political_unit ppu
          JOIN polling_unit pu ON pu.id = ppu.polling_unit_id
          JOIN ward w ON w.id = pu.ward_id
          JOIN lga l ON l.id = w.lga_id
          JOIN state s ON s.id = l.state_id
          WHERE ppu.political_unit_id = pun.id AND ${geo}
        )
      ORDER BY o.hierarchy_level, c.id
      LIMIT ${limitParam}::int
    )
    SELECT
      page.id,
      page.office_name,
      page.hierarchy_level,
      page.seat_name,
      person.full_name,
      (
        SELECT mate_person.full_name
        FROM candidate mate
        JOIN person mate_person ON mate_person.id = mate.person_id
        WHERE mate.principal_candidate_id = page.id
        ORDER BY mate.id
        LIMIT 1
      ) AS deputy_name,
      (
        SELECT COUNT(DISTINCT pu.id)
        FROM pu_political_unit ppu
        JOIN polling_unit pu ON pu.id = ppu.polling_unit_id
        JOIN ward w ON w.id = pu.ward_id
        JOIN lga l ON l.id = w.lga_id
        JOIN state s ON s.id = l.state_id
        WHERE ppu.political_unit_id = page.unit_id AND ${geo}
      ) AS total_pus,
      (
        SELECT COUNT(DISTINCT pu.id)
        FROM agent_assignment aa
        JOIN pu_political_unit ppu ON ppu.polling_unit_id = aa.polling_unit_id
          AND ppu.political_unit_id = page.unit_id
        JOIN polling_unit pu ON pu.id = aa.polling_unit_id
        JOIN ward w ON w.id = pu.ward_id
        JOIN lga l ON l.id = w.lga_id
        JOIN state s ON s.id = l.state_id
        WHERE aa.owner_candidate_id = page.id AND aa.agent_kind = 'official' AND ${geo}
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
    ORDER BY page.hierarchy_level, page.id;
  `;

  return query.dataSource.transaction(async (manager) => {
    const rows = await manager.query<Row[]>(sql, [
      ...query.geoParameters,
      decoded?.level ?? null,
      decoded?.id ?? null,
      query.limit + 1,
    ]);

    const pageRows = rows.slice(0, query.limit);
    const hasMore = rows.length > query.limit;
    const last = pageRows[pageRows.length - 1];

    await manager.query(
      `INSERT INTO audit_log (actor_person_id, action_type, ip_address) VALUES ($1, $2, $3);`,
      [query.actorPersonId, "view_candidate_coverage", query.ipAddress],
    );

    const totalRows = await manager.query<Array<{ total: string }>>(
      `
        SELECT COUNT(*) AS total
        FROM candidate c
        JOIN seat st ON st.id = c.seat_id
        WHERE EXISTS (
          SELECT 1
          FROM pu_political_unit ppu
          JOIN polling_unit pu ON pu.id = ppu.polling_unit_id
          JOIN ward w ON w.id = pu.ward_id
          JOIN lga l ON l.id = w.lga_id
          JOIN state s ON s.id = l.state_id
          WHERE ppu.political_unit_id = st.political_unit_id AND ${geo}
        );
      `,
      query.geoParameters,
    );

    const items = pageRows.map((row): CandidateCoverageItem => {
      const totalPUs = Number(row.total_pus);
      const coveredPUs = Number(row.covered_pus);
      return {
        id: row.id,
        office: row.office_name,
        hierarchyLevel: row.hierarchy_level,
        seat: row.seat_name,
        name: row.full_name,
        deputyName: row.deputy_name,
        totalPUs,
        coveredPUs,
        coveragePct: totalPUs > 0 ? Math.round((coveredPUs / totalPUs) * 100) : 0,
        extraAgentsCount: Number(row.extra_agents),
      };
    });

    return {
      items,
      nextCursor: hasMore && last ? `${last.hierarchy_level}.${last.id}` : null,
      total: Number(totalRows[0]?.total ?? 0),
    };
  });
}
