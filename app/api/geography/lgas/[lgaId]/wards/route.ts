import "server-only";
import { connection } from "next/server";
import { getCoverageScopeFilter, requireApiAuth } from "@/lib/auth/api";
import { failure, internalError, success } from "@/lib/api/response";
import { hasGpsSql } from "@/lib/geography/gps";
import { parsePollingUnitFilter, pollingUnitFilterClauses } from "@/lib/coverage/pu-filter";

export async function GET(request: Request, { params }: { params: Promise<{ lgaId: string }> }) {
  await connection();

  const { lgaId } = await params;

  try {
    const lgaIdNum = Number(lgaId);
    if (!Number.isInteger(lgaIdNum)) {
      return failure("validation_failed", "Invalid LGA ID");
    }

    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;

    const puFilter = parsePollingUnitFilter(new URL(request.url).searchParams);
    if ("error" in puFilter) return puFilter.error;
    const puClauses = pollingUnitFilterClauses(puFilter);
    const puSql = puClauses.map((clause) => ` AND ${clause}`).join("");

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
    }>>(`
      SELECT
        w.id,
        w.inec_ward_code AS code,
        w.ward_name AS name,
        COUNT(DISTINCT pu.id) AS total_pus,
        COUNT(DISTINCT CASE WHEN aa.person_id IS NOT NULL THEN pu.id END) AS covered_pus,
        COUNT(DISTINCT CASE WHEN ${hasGpsSql("pu")} THEN pu.id END) AS gps_pus,
        COUNT(DISTINCT CASE WHEN aa.agent_kind = 'extra' THEN aa.person_id END) AS extra_agents
      FROM ward w
      JOIN lga l ON l.id = w.lga_id
      JOIN state s ON s.id = l.state_id
      LEFT JOIN polling_unit pu ON pu.ward_id = w.id
      LEFT JOIN agent_assignment aa ON aa.polling_unit_id = pu.id AND aa.agent_kind = 'official'
      WHERE w.lga_id = $6 AND ${scope.sql}${puSql}
      GROUP BY w.id, w.inec_ward_code, w.ward_name
      ORDER BY w.ward_name ASC;
    `, [...scope.parameters, lgaIdNum]);

    const result = rows.map((row) => {
      const totalPUs = Number(row.total_pus ?? 0);
      const coveredPUs = Number(row.covered_pus ?? 0);
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        totalPUs,
        gpsPUs: Number(row.gps_pus ?? 0),
        coveredPUs,
        noCoveragePUs: Math.max(totalPUs - coveredPUs, 0),
        officialAgentPct: totalPUs > 0 ? Math.round((coveredPUs / totalPUs) * 100) : 0,
        extraAgentsCount: Number(row.extra_agents ?? 0),
      };
    });

    return success(result);
  } catch (error) {
    console.error("[/api/geography/lgas/[lgaId]/wards] failed", error);
    return internalError();
  }
}
