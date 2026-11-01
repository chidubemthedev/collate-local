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
        COUNT(DISTINCT CASE WHEN pu.latitude IS NOT NULL AND pu.longitude IS NOT NULL THEN pu.id END) AS gps_pus,
        COUNT(DISTINCT CASE WHEN aa.agent_kind = 'extra' THEN aa.person_id END) AS extra_agents,
        COUNT(DISTINCT l.id) AS lgas_count,
        COUNT(DISTINCT w.id) AS wards_count
      FROM state s
      LEFT JOIN lga l ON l.state_id = s.id
      LEFT JOIN ward w ON w.lga_id = l.id
      LEFT JOIN polling_unit pu ON pu.ward_id = w.id
      LEFT JOIN agent_assignment aa ON aa.polling_unit_id = pu.id AND aa.agent_kind = 'official'
      WHERE s.id = $6 AND ${scope.sql}
      GROUP BY s.id, s.inec_state_code, s.state_name;
    `, [...scope.parameters, stateIdNum]);

    const row = rows[0];
    if (!row) {
      return failure("not_found", "State not found");
    }

    const totalPUs = Number(row.total_pus ?? 0);
    const coveredPUs = Number(row.covered_pus ?? 0);
    return success({
      id: row.id,
      code: row.code,
      name: row.name,
      totalPUs,
      gpsPUs: Number(row.gps_pus ?? 0),
      coveredPUs,
      noCoveragePUs: Math.max(totalPUs - coveredPUs, 0),
      officialAgentPct: totalPUs > 0 ? Math.round((coveredPUs / totalPUs) * 100) : 0,
      extraAgentsCount: Number(row.extra_agents ?? 0),
      lgasCount: Number(row.lgas_count ?? 0),
      wardsCount: Number(row.wards_count ?? 0),
    });
  } catch (error) {
    console.error("[/api/geography/states/[stateId]] failed", error);
    return internalError();
  }
}
