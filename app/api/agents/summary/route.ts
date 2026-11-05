import { connection } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { failure, internalError, success } from "@/lib/api/response";
import { policyErrorResponse } from "@/lib/policy/http";
import {
  agentSummaryFiltersSchema,
  policyUserFromCurrentUser,
  summarizeAgents,
} from "@/lib/policy";

const ALLOWED_FIELDS = new Set([
  "stateId",
  "lgaId",
  "wardId",
  "politicalUnitId",
  "ownerGroupId",
  "ownerCandidateId",
  "q",
]);

export async function GET(request: Request): Promise<Response> {
  // Per-request data: keep Next.js from trying to prerender this route at build time.
  await connection();

  try {
    const currentUser = await requireUser();
    const filterValues = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsedFilters = agentSummaryFiltersSchema.safeParse(filterValues);
    if (!parsedFilters.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsedFilters.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && ALLOWED_FIELDS.has(field)) {
          fields[field] = "invalid_value";
        }
      }
      return failure("validation_failed", "Invalid request parameters", fields);
    }

    const user = await policyUserFromCurrentUser(currentUser);
    return success(await summarizeAgents(user, parsedFilters.data));
  } catch (error) {
    const response = policyErrorResponse(error);
    if (response) {
      return response;
    }
    console.error("[/api/agents/summary] request failed", error);
    return internalError();
  }
}
