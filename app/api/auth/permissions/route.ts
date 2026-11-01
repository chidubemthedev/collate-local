import "server-only";
import { connection } from "next/server";
import { requireApiAuth } from "@/lib/auth/api";

export async function GET() {
  await connection();

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;

    return Response.json({
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
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
