import { requireUser } from "@/lib/auth/current-user";
import { failure, internalError, success } from "@/lib/api/response";
import { policyUserFromCurrentUser } from "@/lib/policy";
import { policyErrorResponse } from "@/lib/policy/http";
import { getAdminQueueData } from "@/lib/admin/queue";

export async function GET(): Promise<Response> {
  try {
    const currentUser = await requireUser();
    const user = await policyUserFromCurrentUser(currentUser);
    if (!user.isAdmin) {
      return failure("forbidden", "Admin access required");
    }

    return success(await getAdminQueueData());
  } catch (error) {
    const policyResponse = policyErrorResponse(error);
    if (policyResponse) return policyResponse;
    return internalError();
  }
}
