import "server-only";
import { connection } from "next/server";
import { requireApiAuth } from "@/lib/auth/api";
import { loadHomeArea } from "@/lib/auth/view-as";
import { internalError, success } from "@/lib/api/response";

export async function GET() {
  await connection();

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;
    // Where the current access (own or previewed) sits, so pages open on that area.
    const homeArea = await loadHomeArea(auth.context.dataSource, auth.context);

    return success({
      authenticated: true,
      permissions: {
        isAdmin: auth.context.isAdmin,
        canManageCoverage: auth.context.canManageCoverage,
        canBroadcast: auth.context.canMessage,
        roles: [...new Set(auth.context.roles.map((role) => role.name))],
        ownAccess: auth.context.ownLabel,
        viewAs: auth.context.viewAs?.label ?? null,
        readOnly: auth.context.viewAs !== null,
        homeArea,
      },
    });
  } catch (error) {
    console.error("[/api/auth/permissions] failed", error);
    return internalError();
  }
}
