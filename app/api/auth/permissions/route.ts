import "server-only";
import { connection } from "next/server";
import { requireApiAuth } from "@/lib/auth/api";
import { internalError, success } from "@/lib/api/response";

export async function GET() {
  await connection();

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;

    return success({
      authenticated: true,
      permissions: {
        isAdmin: auth.context.isAdmin,
        canManageCoverage: auth.context.canManageCoverage,
        canBroadcast: auth.context.canManageCoverage,
        roles: [...new Set(auth.context.roles.map((role) => role.name))],
      },
    });
  } catch (error) {
    console.error("[/api/auth/permissions] failed", error);
    return internalError();
  }
}
