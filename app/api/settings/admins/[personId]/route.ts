import "server-only";
import { connection } from "next/server";
import { readOnlyResponse, requireApiAuth } from "@/lib/auth/api";
import { assertSameOrigin, getClientIp } from "@/lib/auth/request";
import { failure, internalError, success } from "@/lib/api/response";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Removes an admin: deletes their memberships of Admin-type groups and signs them out.
 * The person and any other groups they are in stay. You can't remove yourself or the last admin.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  await connection();
  try {
    assertSameOrigin(request);
  } catch {
    return failure("invalid_origin", "Request origin is not allowed");
  }

  const { personId } = await params;
  if (!UUID.test(personId)) return failure("validation_failed", "Invalid admin ID");

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;
    if (auth.context.viewAs) return readOnlyResponse();
    if (!auth.context.isAdmin) return failure("forbidden", "Only admins can manage admins");
    if (personId.toLowerCase() === auth.context.personId.toLowerCase()) {
      return failure("forbidden", "You can't remove yourself as an admin");
    }

    const outcome = await auth.context.dataSource.transaction(async (manager) => {
      // Lock every admin membership, so two removals at once can't take away the last two admins.
      const memberships = (await manager.query(
        `
          SELECT m.id, m.person_id
          FROM membership m
          JOIN groups g ON g.id = m.group_id
          JOIN group_type gt ON gt.id = g.group_type_id
          WHERE gt.type_key = 'admin'
          FOR UPDATE OF m;
        `,
      )) as Array<{ id: number; person_id: string }>;

      const target = memberships.filter((row) => row.person_id.toLowerCase() === personId.toLowerCase());
      if (!target.length) return "not_found" as const;
      if (new Set(memberships.map((row) => row.person_id)).size <= 1) return "last_admin" as const;

      await manager.query(`DELETE FROM membership WHERE id = ANY($1::int[]);`, [target.map((row) => row.id)]);
      // Signed out everywhere; if they still belong to another group they can sign in again.
      await manager.query(`DELETE FROM auth_session WHERE person_id = $1;`, [personId]);
      await manager.query(
        `
          INSERT INTO audit_log
            (actor_person_id, action_type, target_entity_type, target_entity_id, ip_address)
          VALUES ($1, 'settings.admin.removed', 'person', $2, $3);
        `,
        [auth.context.personId, personId, getClientIp(request)],
      );
      return "removed" as const;
    });

    if (outcome === "not_found") return failure("not_found", "Admin not found");
    if (outcome === "last_admin") return failure("conflict", "You can't remove the last admin");
    return success({ ok: true });
  } catch (error) {
    console.error("[/api/settings/admins/[personId]] DELETE failed", error);
    return internalError();
  }
}
