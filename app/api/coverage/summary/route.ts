import "server-only";
import { connection, type NextRequest } from "next/server";
import { getCoverageScopeFilter, requireApiAuth } from "@/lib/auth/api";
import { parseCoverageFilters } from "@/lib/coverage/filters";
import { internalError, success } from "@/lib/api/response";
import { parsePollingUnitFilter, pollingUnitFilterClauses } from "@/lib/coverage/pu-filter";
import { hasGpsSql } from "@/lib/geography/gps";

export async function GET(request: NextRequest) {
  await connection();

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;

    const scope = getCoverageScopeFilter(auth.context, {
      state: "s",
      lga: "l",
      ward: "w",
      pollingUnit: "pu",
    });
    const filters = parseCoverageFilters(request.nextUrl.searchParams, scope.parameters.length + 1);
    if ("error" in filters) return filters.error;
    const puFilter = parsePollingUnitFilter(request.nextUrl.searchParams);
    if ("error" in puFilter) return puFilter.error;
    const whereClauses = [scope.sql, ...filters.clauses, ...pollingUnitFilterClauses(puFilter)];

    const rows = await auth.context.dataSource.query<Array<{
      total_pus: string;
      covered_pus: string;
      gps_pus: string;
      extra_agents: string;
    }>>(
      `
        SELECT
          COUNT(DISTINCT pu.id) AS total_pus,
          COUNT(DISTINCT pu.id) FILTER (WHERE aa.agent_kind = 'official') AS covered_pus,
          COUNT(DISTINCT pu.id) FILTER (WHERE ${hasGpsSql("pu")}) AS gps_pus,
          COUNT(DISTINCT aa.id) FILTER (WHERE aa.agent_kind = 'extra') AS extra_agents
        FROM polling_unit pu
        JOIN ward w ON w.id = pu.ward_id
        JOIN lga l ON l.id = w.lga_id
        JOIN state s ON s.id = l.state_id
        LEFT JOIN agent_assignment aa ON aa.polling_unit_id = pu.id
        WHERE ${whereClauses.join(" AND ")};
      `,
      [...scope.parameters, ...filters.parameters],
    );

    const row = rows[0];
    const totalPUs = Number(row?.total_pus ?? 0);
    const coveredPUs = Number(row?.covered_pus ?? 0);

    return success({
      totalPUs,
      coveredPUs,
      noCoveragePUs: Math.max(totalPUs - coveredPUs, 0),
      gpsPUs: Number(row?.gps_pus ?? 0),
      extraAgentsCount: Number(row?.extra_agents ?? 0),
      officialAgentPct: totalPUs > 0 ? Math.round((coveredPUs / totalPUs) * 100) : 0,
    });
  } catch (error) {
    console.error("[/api/coverage/summary] failed", error);
    return internalError();
  }
}
