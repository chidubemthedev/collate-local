import { requireUser } from "@/lib/auth/current-user";
import { getClientIp } from "@/lib/auth/request";
import { failure, internalError, success } from "@/lib/api/response";
import { policyErrorResponse } from "@/lib/policy/http";
import { policyUserFromCurrentUser } from "@/lib/policy";
import { getBroadcastDetail } from "@/lib/broadcast/queries";
import { broadcastIdSchema } from "@/lib/broadcast/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const currentUser = await requireUser();
    const { id } = await params;
    if (!broadcastIdSchema.safeParse(id).success) {
      return failure("validation_failed", "Invalid broadcast ID");
    }
    const user = await policyUserFromCurrentUser(currentUser);
    const detail = await getBroadcastDetail(user, id, getClientIp(_request));
    if (!detail) {
      return failure("not_found", "Broadcast not found");
    }
    return success(detail);
  } catch (error) {
    const policyResponse = policyErrorResponse(error);
    if (policyResponse) {
      return policyResponse;
    }
    return internalError();
  }
}
