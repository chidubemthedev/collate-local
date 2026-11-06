import "server-only";
import { connection } from "next/server";
import { getCoverageScopeFilter, requireApiAuth } from "@/lib/auth/api";
import { internalError, success } from "@/lib/api/response";
import { parsePollingUnitFilter, pollingUnitFilterClauses } from "@/lib/coverage/pu-filter";
import { hasGpsSql } from "@/lib/geography/gps";
import { extraAgentsByAreaSql } from "@/lib/coverage/area-coverage-sql";

export async function GET(request: Request) {
  await connection();

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;

    const puFilter = parsePollingUnitFilter(new URL(request.url).searchParams);
    if ("error" in puFilter) return puFilter.error;
    const puSql = pollingUnitFilterClauses(puFilter).map((clause) => ` AND ${clause}`).join("");

    const { dataSource } = auth.context;
    const scope = getCoverageScopeFilter(auth.context, {
      state: "s",
      lga: "l",
      ward: "w",
      pollingUnit: "pu",
    });
    const rows = await dataSource.query<Array<{
      id: number;
      code: string;
      name: string;
      total_pus: string;
      covered_pus: string;
      gps_pus: string;
      extra_agents: string;
      lgas_count: string;
      wards_count: string;
    }>>(`
      -- Counted per ward first, then rolled up: no DISTINCT over 177k polling units.
      -- A polling unit has at most one official agent, so that join never repeats a row.
      WITH ward_rows AS (
        SELECT
          s.id AS state_id,
          l.id AS lga_id,
          w.id AS ward_id,
          COUNT(pu.id) AS total_pus,
          COUNT(aa.polling_unit_id) AS covered_pus,
          COUNT(pu.id) FILTER (WHERE ${hasGpsSql("pu")}) AS gps_pus
        FROM state s
        LEFT JOIN lga l ON l.state_id = s.id
        LEFT JOIN ward w ON w.lga_id = l.id
        LEFT JOIN polling_unit pu ON pu.ward_id = w.id
        LEFT JOIN agent_assignment aa ON aa.polling_unit_id = pu.id AND aa.agent_kind = 'official'
        WHERE ${scope.sql}${puSql}
        GROUP BY s.id, l.id, w.id
      ),
      extras AS (${extraAgentsByAreaSql("s.id", `${scope.sql}${puSql}`)})
      SELECT
        s.id,
        s.inec_state_code AS code,
        s.state_name AS name,
        SUM(r.total_pus) AS total_pus,
        SUM(r.covered_pus) AS covered_pus,
        SUM(r.gps_pus) AS gps_pus,
        COALESCE(MAX(e.extra_agents), 0) AS extra_agents,
        COUNT(DISTINCT r.lga_id) AS lgas_count,
        COUNT(r.ward_id) AS wards_count
      FROM ward_rows r
      JOIN state s ON s.id = r.state_id
      LEFT JOIN extras e ON e.area_id = s.id
      GROUP BY s.id, s.inec_state_code, s.state_name
      ORDER BY s.state_name ASC;
    `, scope.parameters);

    const result = rows.map((row) => {
      const totalPUs = Number(row.total_pus ?? 0);
      const coveredPUs = Number(row.covered_pus ?? 0);
      const gpsPUs = Number(row.gps_pus ?? 0);
      const extraAgents = Number(row.extra_agents ?? 0);
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        totalPUs,
        gpsPUs,
        coveredPUs,
        noCoveragePUs: Math.max(totalPUs - coveredPUs, 0),
        officialAgentPct: totalPUs > 0 ? Math.round((coveredPUs / totalPUs) * 100) : 0,
        extraAgentsCount: extraAgents,
        lgasCount: Number(row.lgas_count ?? 0),
        wardsCount: Number(row.wards_count ?? 0),
      };
    });

    return success(result);
  } catch (error) {
    console.error("[/api/geography/states] failed", error);
    return internalError();
  }
}
