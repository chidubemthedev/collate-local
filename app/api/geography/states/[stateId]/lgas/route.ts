import "server-only";
import { connection } from "next/server";
import { getCoverageScopeFilter, requireApiAuth } from "@/lib/auth/api";
import { failure, internalError, success } from "@/lib/api/response";

export async function GET(_: Request, { params }: { params: Promise<{ stateId: string }> }) {
  await connection();

  const { stateId } = await params;

  try {
    const stateIdNum = Number(stateId);
    if (!Number.isInteger(stateIdNum)) {
      return failure("validation_failed", "Invalid state ID");
    }

    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;

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
      SELECT
        l.id,
        s.id AS state_id,
        s.inec_state_code,
        l.inec_lga_code AS code,
        l.lga_name AS name,
        COUNT(DISTINCT pu.id) AS total_pus,
        COUNT(DISTINCT CASE WHEN aa.person_id IS NOT NULL THEN pu.id END) AS covered_pus,
        COUNT(DISTINCT CASE WHEN pu.latitude IS NOT NULL AND pu.longitude IS NOT NULL THEN pu.id END) AS gps_pus,
        COUNT(DISTINCT w.id) AS wards_count,
        COUNT(DISTINCT CASE WHEN aa.agent_kind = 'extra' THEN aa.person_id END) AS extra_agents
      FROM lga l
      JOIN state s ON s.id = l.state_id
      LEFT JOIN ward w ON w.lga_id = l.id
      LEFT JOIN polling_unit pu ON pu.ward_id = w.id
      LEFT JOIN agent_assignment aa ON aa.polling_unit_id = pu.id AND aa.agent_kind = 'official'
      WHERE l.state_id = $6 AND ${scope.sql}
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
