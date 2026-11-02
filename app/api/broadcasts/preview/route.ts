import { requireUser } from "@/lib/auth/current-user";
import { assertSameOrigin } from "@/lib/auth/request";
import { failure, internalError, success } from "@/lib/api/response";
import { policyErrorResponse } from "@/lib/policy/http";
import { policyUserFromCurrentUser } from "@/lib/policy";
import { previewAudience } from "@/lib/policy/core/audience";
import { audienceFilterSchema } from "@/lib/broadcast/schemas";

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
  } catch {
    return failure("invalid_origin", "The request origin is not allowed");
  }

  try {
    const currentUser = await requireUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure("validation_failed", "Invalid request body");
    }

    const parsed = audienceFilterSchema.safeParse(body);
    if (!parsed.success) {
      return failure("validation_failed", "Invalid request body");
    }

    const user = await policyUserFromCurrentUser(currentUser);
    const counts = await previewAudience(user, parsed.data);
    return success({
      officialCount: counts.officialCount,
      extraCount: counts.extraCount,
    });
  } catch (error) {
    const policyResponse = policyErrorResponse(error);
    if (policyResponse) {
      return policyResponse;
    }
    return internalError();
  }
}
