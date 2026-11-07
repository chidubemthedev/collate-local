import "server-only";
import { connection, type NextRequest } from "next/server";
import { getCoverageScopeFilter, requireApiAuth } from "@/lib/auth/api";
import { parseCoverageFilters, parseCoverageGpsFilter } from "@/lib/coverage/filters";
import { decodeGapsCursor, encodeGapsCursor } from "@/lib/coverage/gaps-cursor";
import { failure, internalError, success } from "@/lib/api/response";
import { gpsFilterSql } from "@/lib/geography/gps";

type GapRow = {
  id: number;
  code: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  has_gps: boolean;
  ward_code: string;
  ward_name: string;
  lga_code: string;
  lga_name: string;
  state_code: string;
  state_name: string;
};

/**
 * Polling units with no official agent (coverage gaps), a page at a time.
 * Query: stateId, lgaId, wardId, politicalUnitId, gps, limit (1-500, default 100), cursor.
 * totalCount is worked out on the first page only (no cursor); later pages return null.
 */
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
    const gpsFilter = parseCoverageGpsFilter(request.nextUrl.searchParams);
    if (gpsFilter === null) {
      return failure("validation_failed", "Invalid request parameters");
    }
    const gpsClause = gpsFilterSql(gpsFilter, "pu");

    const rawLimit = request.nextUrl.searchParams.get("limit");
    const limit = rawLimit === null ? 100 : Number(rawLimit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
      return failure("validation_failed", "Invalid limit", { limit: "must_be_between_1_and_500" });
    }
    const rawCursor = request.nextUrl.searchParams.get("cursor");
    const cursor = rawCursor ? decodeGapsCursor(rawCursor) : null;
    if (rawCursor && !cursor) {
      return failure("validation_failed", "Invalid cursor", { cursor: "invalid" });
    }

    const baseParameters = [...scope.parameters, ...filters.parameters];
    const where = [
      scope.sql,
      ...filters.clauses,
      ...(gpsClause ? [gpsClause] : []),
      `NOT EXISTS (
        SELECT 1
        FROM agent_assignment aa
        WHERE aa.polling_unit_id = pu.id AND aa.agent_kind = 'official'
      )`,
    ];
    const from = `
      FROM polling_unit pu
      JOIN ward w ON w.id = pu.ward_id
      JOIN lga l ON l.id = w.lga_id
      JOIN state s ON s.id = l.state_id
    `;

    // Rows after the cursor, in the same order as the list.
    const pageParameters: unknown[] = [...baseParameters];
    const pageWhere = [...where];
    if (cursor) {
      const first = pageParameters.length + 1;
      pageWhere.push(
        `(s.state_name, l.lga_name, w.ward_name, pu.inec_polling_unit_code, pu.id) > ` +
          `($${first}::text, $${first + 1}::text, $${first + 2}::text, $${first + 3}::text, $${first + 4}::int)`,
      );
      pageParameters.push(cursor.stateName, cursor.lgaName, cursor.wardName, cursor.code, cursor.id);
    }
    pageParameters.push(limit + 1);

    const rowsQuery = auth.context.dataSource.query<GapRow[]>(
      `
        SELECT
          pu.id,
          pu.inec_polling_unit_code AS code,
          pu.polling_unit_name AS name,
          pu.latitude,
          pu.longitude,
          ${gpsFilterSql("with", "pu")} AS has_gps,
          w.inec_ward_code AS ward_code,
          w.ward_name,
          l.inec_lga_code AS lga_code,
          l.lga_name,
          s.inec_state_code AS state_code,
          s.state_name
        ${from}
        WHERE ${pageWhere.join(" AND ")}
        ORDER BY s.state_name, l.lga_name, w.ward_name, pu.inec_polling_unit_code, pu.id
        LIMIT $${pageParameters.length};
      `,
      pageParameters,
    );
    const countQuery = cursor
      ? Promise.resolve(null)
      : auth.context.dataSource.query<Array<{ total: number }>>(
          `SELECT COUNT(*)::int AS total ${from} WHERE ${where.join(" AND ")};`,
          baseParameters,
        );
    const [rows, count] = await Promise.all([rowsQuery, countQuery]);

    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor =
      rows.length > limit && last
        ? encodeGapsCursor({
            stateName: last.state_name,
            lgaName: last.lga_name,
            wardName: last.ward_name,
            code: last.code,
            id: Number(last.id),
          })
        : null;

    return success(
      {
        totalCount: count ? Number(count[0]?.total ?? 0) : null,
        limit,
        items: page.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name ?? "Unnamed PU",
          latitude: row.latitude,
          longitude: row.longitude,
          hasGPS: row.has_gps,
          hasGps: row.has_gps,
          ward: { code: row.ward_code, name: row.ward_name },
          lga: { code: row.lga_code, name: row.lga_name },
          state: { code: row.state_code, name: row.state_name },
        })),
      },
      { nextCursor, limit },
    );
  } catch (error) {
    console.error("[/api/coverage/gaps] failed", error);
    return internalError();
  }
}
