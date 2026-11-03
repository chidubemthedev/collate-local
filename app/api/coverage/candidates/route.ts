import "server-only";
import { connection, type NextRequest } from "next/server";
import { getCoverageScopeFilter, requireApiAuth } from "@/lib/auth/api";
import { getClientIp } from "@/lib/auth/request";
import { parseCoverageFilters } from "@/lib/coverage/filters";
import {
  CANDIDATE_COVERAGE_MAX_LIMIT,
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

    const scope = getCoverageScopeFilter(auth.context, {
      state: "s",
      lga: "l",
      ward: "w",
      pollingUnit: "pu",
    });
    const filters = parseCoverageFilters(params, scope.parameters.length + 1);
    if ("error" in filters) return filters.error;

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
