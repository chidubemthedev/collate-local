import "server-only";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { internalError, success } from "@/lib/api/response";
import { policyErrorResponse } from "@/lib/policy/http";
import { listOwnerGroups, policyUserFromCurrentUser } from "@/lib/policy";

/** Groups the user may see as agent owners (the "Sponsor / owner" filter). */
export async function GET(): Promise<Response> {
  await connection();

  try {
    const currentUser = await requireUser();
    const user = await policyUserFromCurrentUser(currentUser);
    return success(await listOwnerGroups(user));
  } catch (error) {
    const response = policyErrorResponse(error);
    if (response) return response;
    console.error("[/api/groups] request failed", error);
    return internalError();
  }
}
