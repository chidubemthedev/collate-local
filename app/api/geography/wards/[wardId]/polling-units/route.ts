import "server-only";
import { connection } from "next/server";
import { getCoverageScopeFilter, requireApiAuth } from "@/lib/auth/api";
import { failure, internalError, success } from "@/lib/api/response";

export async function GET(_: Request, { params }: { params: Promise<{ wardId: string }> }) {
  await connection();

  const { wardId } = await params;

  try {
    const wardIdNum = Number(wardId);
    if (!Number.isInteger(wardIdNum)) {
      return failure("validation_failed", "Invalid ward ID");
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
      name: string | null;
      latitude: number | null;
      longitude: number | null;
      ward_id: number;
      lga_id: number;
      state_id: number;
      ward_code: string;
      lga_code: string;
      state_code: string;
      official_name: string | null;
      official_phone: string | null;
      official_status: string | null;
      extra_agents: Array<{
        id: string;
        name: string;
        owner: string;
        role: string;
        phone: string | null;
        telegramStatus: string;
      }>;
    }>>(`
      SELECT
        pu.id,
        pu.inec_polling_unit_code AS code,
        pu.polling_unit_name AS name,
        pu.latitude,
        pu.longitude,
        w.id AS ward_id,
        l.id AS lga_id,
        s.id AS state_id,
        w.inec_ward_code AS ward_code,
        l.inec_lga_code AS lga_code,
        s.inec_state_code AS state_code,
        p.full_name AS official_name,
        pn.e164_number AS official_phone,
        CASE 
          WHEN aa.agent_kind = 'official' THEN 'connected'
          ELSE NULL
        END AS official_status,
        COALESCE(
          json_agg(
            json_build_object(
              'id', p2.id,
              'name', p2.full_name,
              'owner', 'Party',
              'role', 'Protector',
              'phone', pn2.e164_number,
              'telegramStatus', 'connected'
            )
          ) FILTER (WHERE aa2.agent_kind = 'extra'),
          '[]'::json
        ) AS extra_agents
      FROM polling_unit pu
      JOIN ward w ON w.id = pu.ward_id
      JOIN lga l ON l.id = w.lga_id
      JOIN state s ON s.id = l.state_id
      LEFT JOIN LATERAL (
        SELECT aa.person_id, aa.agent_kind
        FROM agent_assignment aa
        WHERE aa.polling_unit_id = pu.id AND aa.agent_kind = 'official'
        LIMIT 1
      ) aa ON true
      LEFT JOIN person p ON p.id = aa.person_id
      LEFT JOIN LATERAL (
        SELECT e164_number
        FROM phone_number
        WHERE person_id = p.id
        ORDER BY is_confirmed DESC, created_at ASC
        LIMIT 1
      ) pn ON true
      LEFT JOIN LATERAL (
        SELECT aa2.person_id, aa2.agent_kind
        FROM agent_assignment aa2
        WHERE aa2.polling_unit_id = pu.id AND aa2.agent_kind = 'extra'
      ) aa2 ON true
      LEFT JOIN person p2 ON p2.id = aa2.person_id
      LEFT JOIN LATERAL (
        SELECT e164_number
        FROM phone_number
        WHERE person_id = p2.id
        ORDER BY is_confirmed DESC, created_at ASC
        LIMIT 1
      ) pn2 ON true
      WHERE pu.ward_id = $6 AND ${scope.sql}
      GROUP BY
        pu.id, pu.inec_polling_unit_code, pu.polling_unit_name, pu.latitude, pu.longitude,
        w.id, l.id, s.id,
        w.inec_ward_code, l.inec_lga_code, s.inec_state_code,
        p.full_name, pn.e164_number, aa.agent_kind
      ORDER BY pu.polling_unit_name ASC;
    `, [...scope.parameters, wardIdNum]);

    const result = rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name ?? "Unnamed PU",
      wardCode: row.ward_code,
      lgaCode: row.lga_code,
      stateCode: row.state_code,
      latitude: row.latitude,
      longitude: row.longitude,
      hasGPS: Boolean(row.latitude !== null && row.longitude !== null),
      hasOfficialAgent: Boolean(row.official_name),
      officialAgentName: row.official_name ?? undefined,
      officialAgentPhone: row.official_phone ?? undefined,
      officialAgentTelegramStatus: row.official_status ?? undefined,
      extraAgents: row.extra_agents,
    }));

    return success(result);
  } catch (error) {
    console.error("[/api/geography/wards/[wardId]/polling-units] failed", error);
    return internalError();
  }
}
