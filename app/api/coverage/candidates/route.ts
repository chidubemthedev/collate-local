import "server-only";
import { connection, type NextRequest } from "next/server";
import { getCoverageScopeFilter, requireApiAuth } from "@/lib/auth/api";
import { getClientIp } from "@/lib/auth/request";
import { parseCoverageFilters } from "@/lib/coverage/filters";
import {
  CANDIDATE_COVERAGE_MAX_LIMIT,
  countCandidates,
  decodeCandidateCoverageCursor,
  listCandidateCoverage,
} from "@/lib/coverage/candidate-coverage";
import { failure, internalError, success } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  await connection();

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;

    const params = request.nextUrl.searchParams;

    const rawLimit = params.get("limit");
    const limit = rawLimit === null ? 50 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > CANDIDATE_COVERAGE_MAX_LIMIT) {
      return failure("validation_failed", "Invalid request parameters", { limit: "invalid_value" });
    }

    const cursor = params.get("cursor");
    if (cursor !== null && !decodeCandidateCoverageCursor(cursor)) {
      return failure("validation_failed", "Invalid request parameters", { cursor: "invalid_value" });
    }

    const rawOffice = params.get("officeId");
    const officeId = rawOffice === null ? null : Number(rawOffice);
    if (officeId !== null && (!Number.isInteger(officeId) || officeId < 1 || officeId > 2147483647)) {
      return failure("validation_failed", "Invalid request parameters", { officeId: "invalid_value" });
    }

    const rawNational = params.get("nationalOnly");
    if (rawNational !== null && rawNational !== "true" && rawNational !== "false") {
      return failure("validation_failed", "Invalid request parameters", { nationalOnly: "invalid_value" });
    }
    const nationalOnly = rawNational === "true";

    // Seat-overlap filters: pick seats touching an area without clipping their coverage.
    const overlap: { stateId: number | null; lgaId: number | null; wardId: number | null } = {
      stateId: null,
      lgaId: null,
      wardId: null,
    };
    for (const [param, key] of [
      ["overlapStateId", "stateId"],
      ["overlapLgaId", "lgaId"],
      ["overlapWardId", "wardId"],
    ] as const) {
      const raw = params.get(param);
      if (raw === null) continue;
      const value = Number(raw);
      if (!Number.isInteger(value) || value < 1 || value > 2147483647) {
        return failure("validation_failed", "Invalid request parameters", { [param]: "invalid_value" });
      }
      overlap[key] = value;
    }

    const scope = getCoverageScopeFilter(auth.context, {
      state: "s",
      lga: "l",
      ward: "w",
      pollingUnit: "pu",
    });
    const filters = parseCoverageFilters(params, scope.parameters.length + 1);
    if ("error" in filters) return filters.error;

    // countOnly=true returns just meta.total, skipping the coverage figures entirely.
    const rawCountOnly = params.get("countOnly");
    if (rawCountOnly !== null && rawCountOnly !== "true" && rawCountOnly !== "false") {
      return failure("validation_failed", "Invalid request parameters", { countOnly: "invalid_value" });
    }
    if (rawCountOnly === "true") {
      const total = await countCandidates({
        dataSource: auth.context.dataSource,
        geoSql: [scope.sql, ...filters.clauses].join(" AND "),
        geoParameters: [...scope.parameters, ...filters.parameters],
        firstFreeParameter: scope.parameters.length + filters.parameters.length + 1,
        officeId,
        nationalOnly,
        overlap,
      });
      return success([], { total });
    }

    const page = await listCandidateCoverage({
      dataSource: auth.context.dataSource,
      actorPersonId: auth.context.personId,
      ipAddress: getClientIp(request),
      geoSql: [scope.sql, ...filters.clauses].join(" AND "),
      geoParameters: [...scope.parameters, ...filters.parameters],
      firstFreeParameter: scope.parameters.length + filters.parameters.length + 1,
      limit,
      cursor,
      officeId,
      nationalOnly,
      overlap,
    });

    return success(page.items, {
      nextCursor: page.nextCursor,
      limit,
      total: page.total,
      ...(page.offices ? { offices: page.offices } : {}),
    });
  } catch (error) {
    console.error("[/api/coverage/candidates] failed", error);
    return internalError();
  }
}
