import "server-only";
import { connection, type NextRequest } from "next/server";
import { getCoverageScopeFilter, requireApiAuth } from "@/lib/auth/api";
import { internalError, success } from "@/lib/api/response";
import { parseCoverageFilters } from "@/lib/coverage/filters";

interface CoordinateRow {
  latitude: number;
  longitude: number;
  total_pus: number;
  covered_pus: number;
}

export async function GET(request: NextRequest): Promise<Response> {
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
    const filters = parseCoverageFilters(
      request.nextUrl.searchParams,
      scope.parameters.length + 1,
    );
    if ("error" in filters) return filters.error;

    const rows = await auth.context.dataSource.query<CoordinateRow[]>(
      `
        SELECT
          pu.latitude,
          pu.longitude,
          COUNT(*)::int AS total_pus,
          COUNT(*) FILTER (WHERE aa.id IS NOT NULL)::int AS covered_pus
        FROM polling_unit pu
        JOIN ward w ON w.id = pu.ward_id
        JOIN lga l ON l.id = w.lga_id
        JOIN state s ON s.id = l.state_id
        LEFT JOIN agent_assignment aa
          ON aa.polling_unit_id = pu.id AND aa.agent_kind = 'official'
        WHERE ${[
          scope.sql,
          ...filters.clauses,
          "pu.latitude IS NOT NULL",
          "pu.longitude IS NOT NULL",
          "pu.latitude BETWEEN -90 AND 90",
          "pu.longitude BETWEEN -180 AND 180",
        ].join(" AND ")}
        GROUP BY pu.latitude, pu.longitude
        ORDER BY pu.latitude, pu.longitude;
      `,
      [...scope.parameters, ...filters.parameters],
    );

    return success({
      points: rows.map((row) => ({
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        totalPUs: Number(row.total_pus),
        coveredPUs: Number(row.covered_pus),
      })),
    });
  } catch {
    console.error("[/api/coverage/map-points] failed");
    return internalError();
  }
}
