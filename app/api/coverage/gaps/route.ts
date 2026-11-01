import "server-only";
import { connection, type NextRequest } from "next/server";
import { getCoverageScopeFilter, requireApiAuth } from "@/lib/auth/api";
import { parseCoverageFilters } from "@/lib/coverage/filters";

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

    const rawLimit = request.nextUrl.searchParams.get("limit");
    const rawOffset = request.nextUrl.searchParams.get("offset");
    const limit = rawLimit === null ? 100 : Number(rawLimit);
    const offset = rawOffset === null ? 0 : Number(rawOffset);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
      return Response.json({ error: "invalid_limit" }, { status: 400 });
    }
    if (!Number.isSafeInteger(offset) || offset < 0) {
      return Response.json({ error: "invalid_offset" }, { status: 400 });
    }

    const limitParameter = scope.parameters.length + filters.parameters.length + 1;
    const offsetParameter = limitParameter + 1;
    const rows = await auth.context.dataSource.query<Array<{
      id: number;
      code: string;
      name: string | null;
      latitude: number | null;
      longitude: number | null;
      ward_code: string;
      ward_name: string;
      lga_code: string;
      lga_name: string;
      state_code: string;
      state_name: string;
      total_count: string;
    }>>(
      `
        SELECT
          pu.id,
          pu.inec_polling_unit_code AS code,
          pu.polling_unit_name AS name,
          pu.latitude,
          pu.longitude,
          w.inec_ward_code AS ward_code,
          w.ward_name,
          l.inec_lga_code AS lga_code,
          l.lga_name,
          s.inec_state_code AS state_code,
          s.state_name,
          COUNT(*) OVER() AS total_count
        FROM polling_unit pu
        JOIN ward w ON w.id = pu.ward_id
        JOIN lga l ON l.id = w.lga_id
        JOIN state s ON s.id = l.state_id
        WHERE ${[
          scope.sql,
          ...filters.clauses,
          `NOT EXISTS (
            SELECT 1
            FROM agent_assignment aa
            WHERE aa.polling_unit_id = pu.id AND aa.agent_kind = 'official'
          )`,
        ].join(" AND ")}
        ORDER BY s.state_name, l.lga_name, w.ward_name, pu.inec_polling_unit_code
        LIMIT $${limitParameter} OFFSET $${offsetParameter};
      `,
      [...scope.parameters, ...filters.parameters, limit, offset],
    );

    return Response.json({
      totalCount: Number(rows[0]?.total_count ?? 0),
      limit,
      offset,
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name ?? "Unnamed PU",
        latitude: row.latitude,
        longitude: row.longitude,
        hasGPS: row.latitude !== null && row.longitude !== null,
        ward: { code: row.ward_code, name: row.ward_name },
        lga: { code: row.lga_code, name: row.lga_name },
        state: { code: row.state_code, name: row.state_name },
      })),
    });
  } catch (error) {
    console.error("[/api/coverage/gaps] failed", error);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
