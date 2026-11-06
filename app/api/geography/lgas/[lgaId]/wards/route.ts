import "server-only";
import { connection } from "next/server";
import { getCoverageScopeFilter, requireApiAuth } from "@/lib/auth/api";
import { failure, internalError, success } from "@/lib/api/response";
import { hasGpsSql } from "@/lib/geography/gps";
import { extraAgentsByAreaSql } from "@/lib/coverage/area-coverage-sql";
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
      -- A polling unit has at most one official agent, so that join never repeats a row;
      -- extra agents are counted separately.
      WITH extras AS (${extraAgentsByAreaSql("w.id", `w.lga_id = $6 AND ${scope.sql}${puSql}`)})
      SELECT
        w.id,
        w.inec_ward_code AS code,
        w.ward_name AS name,
        COUNT(pu.id) AS total_pus,
        COUNT(aa.polling_unit_id) AS covered_pus,
        COUNT(pu.id) FILTER (WHERE ${hasGpsSql("pu")}) AS gps_pus,
        COALESCE(MAX(e.extra_agents), 0) AS extra_agents
      FROM ward w
      JOIN lga l ON l.id = w.lga_id
      JOIN state s ON s.id = l.state_id
      LEFT JOIN polling_unit pu ON pu.ward_id = w.id
      LEFT JOIN agent_assignment aa ON aa.polling_unit_id = pu.id AND aa.agent_kind = 'official'
      LEFT JOIN extras e ON e.area_id = w.id
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
