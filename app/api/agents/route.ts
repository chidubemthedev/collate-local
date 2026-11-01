import { getClientIp } from "@/lib/auth/request";
import { requireUser } from "@/lib/auth/current-user";
import { failure, internalError, success } from "@/lib/api/response";
import { InvalidFilterError } from "@/lib/policy/errors";
import { policyErrorResponse } from "@/lib/policy/http";
import {
  agentFiltersSchema,
  listAgents,
  policyUserFromCurrentUser,
} from "@/lib/policy";

export async function GET(request: Request): Promise<Response> {
  try {
    const currentUser = await requireUser();
    const filterValues = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsedFilters = agentFiltersSchema.safeParse(filterValues);
    if (!parsedFilters.success) {
      return failure(
        "validation_failed",
        "Invalid request parameters",
        getValidationFields(parsedFilters.error.issues),
      );
    }

    const user = await policyUserFromCurrentUser(currentUser);
    const page = await listAgents(user, parsedFilters.data, {
      ipAddress: getClientIp(request),
    });

    return success(page.items, {
      nextCursor: page.nextCursor,
      limit: parsedFilters.data.limit,
    });
  } catch (error) {
    const response = policyErrorResponse(error);
    if (response) {
      return response;
    }
    console.error("[/api/agents] request failed");
    return internalError();
  }
}

function getValidationFields(
  issues: Array<{ path: Array<string | number | symbol>; code: string }>,
): Record<string, string> {
  const fields: Record<string, string> = {};
  const allowedFields = new Set([
    "stateId",
    "lgaId",
    "wardId",
    "politicalUnitId",
    "ownerGroupId",
    "ownerCandidateId",
    "agentKind",
    "cursor",
    "limit",
  ]);

  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || !allowedFields.has(field)) {
      continue;
    }

    fields[field] = field === "limit" && issue.code === "too_big"
      ? "must_be_at_most_100"
      : field === "limit" && issue.code === "too_small"
        ? "must_be_at_least_1"
        : field === "cursor" && issue.code === "too_big"
          ? "must_be_at_most_512"
          : "invalid_value";
  }

  return fields;
}
