import "server-only";
import { connection } from "next/server";
import { getCoverageScopeFilter, requireApiAuth } from "@/lib/auth/api";
import { failure, internalError, success } from "@/lib/api/response";
import { hasGpsSql } from "@/lib/geography/gps";
import { extraAgentsByAreaSql } from "@/lib/coverage/area-coverage-sql";
import { parsePollingUnitFilter, pollingUnitFilterClauses } from "@/lib/coverage/pu-filter";

export async function GET(request: Request, { params }: { params: Promise<{ stateId: string }> }) {
  await connection();

  const { stateId } = await params;

  try {
    const stateIdNum = Number(stateId);
    if (!Number.isInteger(stateIdNum)) {
      return failure("validation_failed", "Invalid state ID");
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
      state_id: number;
      inec_state_code: string;
      code: string;
      name: string;
      total_pus: string;
      covered_pus: string;
      gps_pus: string;
      wards_count: string;
      extra_agents: string;
    }>>(`
      -- Counted per ward first, then rolled up. A polling unit has at most one official agent,
      -- so that join never repeats a row; extra agents are counted separately.
      WITH ward_rows AS (
        SELECT
          l.id AS lga_id,
          w.id AS ward_id,
          COUNT(pu.id) AS total_pus,
          COUNT(aa.polling_unit_id) AS covered_pus,
          COUNT(pu.id) FILTER (WHERE ${hasGpsSql("pu")}) AS gps_pus
        FROM lga l
        JOIN state s ON s.id = l.state_id
        LEFT JOIN ward w ON w.lga_id = l.id
        LEFT JOIN polling_unit pu ON pu.ward_id = w.id
        LEFT JOIN agent_assignment aa ON aa.polling_unit_id = pu.id AND aa.agent_kind = 'official'
        WHERE l.state_id = $6 AND ${scope.sql}${puSql}
        GROUP BY l.id, w.id
      ),
      extras AS (${extraAgentsByAreaSql("l.id", `l.state_id = $6 AND ${scope.sql}${puSql}`)})
      SELECT
        l.id,
        s.id AS state_id,
        s.inec_state_code,
        l.inec_lga_code AS code,
        l.lga_name AS name,
        SUM(r.total_pus) AS total_pus,
        SUM(r.covered_pus) AS covered_pus,
        SUM(r.gps_pus) AS gps_pus,
        COUNT(r.ward_id) AS wards_count,
        COALESCE(MAX(e.extra_agents), 0) AS extra_agents
      FROM ward_rows r
      JOIN lga l ON l.id = r.lga_id
      JOIN state s ON s.id = l.state_id
      LEFT JOIN extras e ON e.area_id = l.id
      GROUP BY l.id, s.id, s.inec_state_code, l.inec_lga_code, l.lga_name
      ORDER BY l.lga_name ASC;
    `, [...scope.parameters, stateIdNum]);

    const result = rows.map((row) => {
      const totalPUs = Number(row.total_pus ?? 0);
      const coveredPUs = Number(row.covered_pus ?? 0);
      return {
        id: row.id,
        stateId: row.state_id,
        inecStateCode: row.inec_state_code,
        code: row.code,
        name: row.name,
        totalPUs,
        gpsPUs: Number(row.gps_pus ?? 0),
        coveredPUs,
        noCoveragePUs: Math.max(totalPUs - coveredPUs, 0),
        officialAgentPct: totalPUs > 0 ? Math.round((coveredPUs / totalPUs) * 100) : 0,
        extraAgentsCount: Number(row.extra_agents ?? 0),
        wardsCount: Number(row.wards_count ?? 0),
      };
    });

    return success(result);
  } catch (error) {
    console.error("[/api/geography/states/[stateId]/lgas] failed", error);
    return internalError();
  }
}
