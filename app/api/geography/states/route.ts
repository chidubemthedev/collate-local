import "server-only";
import { connection } from "next/server";
import { getCoverageScopeFilter, requireApiAuth } from "@/lib/auth/api";
import { internalError, success } from "@/lib/api/response";
import { parsePollingUnitFilter, pollingUnitFilterClauses } from "@/lib/coverage/pu-filter";
import { hasGpsSql } from "@/lib/geography/gps";

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
      SELECT
        s.id,
        s.inec_state_code AS code,
        s.state_name AS name,
        COUNT(DISTINCT pu.id) AS total_pus,
        COUNT(DISTINCT CASE WHEN aa.person_id IS NOT NULL THEN pu.id END) AS covered_pus,
        COUNT(DISTINCT CASE WHEN ${hasGpsSql("pu")} THEN pu.id END) AS gps_pus,
        COUNT(DISTINCT CASE WHEN aa.agent_kind = 'extra' THEN aa.person_id END) AS extra_agents,
        COUNT(DISTINCT l.id) AS lgas_count,
        COUNT(DISTINCT w.id) AS wards_count
      FROM state s
      LEFT JOIN lga l ON l.state_id = s.id
      LEFT JOIN ward w ON w.lga_id = l.id
      LEFT JOIN polling_unit pu ON pu.ward_id = w.id
      LEFT JOIN agent_assignment aa ON aa.polling_unit_id = pu.id AND aa.agent_kind = 'official'
      WHERE ${scope.sql}${puSql}
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
