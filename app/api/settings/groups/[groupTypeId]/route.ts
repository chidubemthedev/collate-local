import "server-only";
import { connection } from "next/server";
import { readOnlyResponse, requireApiAuth } from "@/lib/auth/api";
import { assertSameOrigin, getClientIp } from "@/lib/auth/request";
import { failure, internalError, success } from "@/lib/api/response";
import type { GroupTypeImpact } from "@/types/api";

type Params = { params: Promise<{ groupTypeId: string }> };

type TypeRow = { id: number; type_name: string; is_system: boolean };
type GroupRow = { id: number; group_name: string; members: number; agents: number };

const FORBIDDEN = "Only admins can manage groups and access";

function parseId(value: string): number | null {
  if (!/^[1-9][0-9]{0,9}$/.test(value)) return null;
  const id = Number(value);
  return id <= 2147483647 ? id : null;
}

/** The groups that use a type, with how many members and agents each has. */
const GROUPS_USING_TYPE_SQL = `
  SELECT g.id, g.group_name,
    (SELECT COUNT(*)::int FROM membership m WHERE m.group_id = g.id) AS members,
    (SELECT COUNT(*)::int FROM agent_assignment aa WHERE aa.owner_group_id = g.id) AS agents
  FROM groups g
  WHERE g.group_type_id = $1
  ORDER BY g.group_name;
`;

/** What deleting this group type would affect. Shown in the "Are you sure?" dialog. Admins only. */
export async function GET(_request: Request, { params }: Params) {
  await connection();
  const id = parseId((await params).groupTypeId);
  if (id === null) return failure("validation_failed", "Invalid group ID");

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;
    if (!auth.context.isAdmin) return failure("forbidden", FORBIDDEN);

    const [type] = await auth.context.dataSource.query<TypeRow[]>(
      `SELECT id, type_name, is_system FROM group_type WHERE id = $1;`,
      [id],
    );
    if (!type) return failure("not_found", "Group not found");
    const groups = await auth.context.dataSource.query<GroupRow[]>(GROUPS_USING_TYPE_SQL, [id]);

    const impact: GroupTypeImpact = {
      id: Number(type.id),
      name: type.type_name,
      isSystem: type.is_system,
      canDelete: !type.is_system && groups.length === 0,
      groups: groups.map((group) => ({
        id: Number(group.id),
        name: group.group_name,
        members: Number(group.members),
        agents: Number(group.agents),
      })),
    };
    return success(impact);
  } catch (error) {
    console.error("[/api/settings/groups/[groupTypeId]] GET failed", error);
    return internalError();
  }
}

/**
 * Deletes a group type an admin made. Built-in types can't be deleted, nor a type any group
 * still uses: deleting it would leave those groups (and their members and agents) without rules.
 */
export async function DELETE(request: Request, { params }: Params) {
  await connection();
  try {
    assertSameOrigin(request);
  } catch {
    return failure("invalid_origin", "Request origin is not allowed");
  }
  const id = parseId((await params).groupTypeId);
  if (id === null) return failure("validation_failed", "Invalid group ID");

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;
    if (auth.context.viewAs) return readOnlyResponse();
    if (!auth.context.isAdmin) return failure("forbidden", FORBIDDEN);

    const outcome = await auth.context.dataSource.transaction(async (manager) => {
      const [type] = (await manager.query(
        `SELECT id, type_name, is_system FROM group_type WHERE id = $1 FOR UPDATE;`,
        [id],
      )) as TypeRow[];
      if (!type) return "not_found" as const;
      if (type.is_system) return "system" as const;
      const [inUse] = (await manager.query(`SELECT COUNT(*)::int AS groups FROM groups WHERE group_type_id = $1;`, [
        id,
      ])) as Array<{ groups: number }>;
      if (Number(inUse?.groups ?? 0) > 0) return { inUse: Number(inUse.groups) };

      await manager.query(`DELETE FROM group_type WHERE id = $1;`, [id]);
      await manager.query(
        `
          INSERT INTO audit_log
            (actor_person_id, action_type, target_entity_type, target_entity_id, ip_address)
          VALUES ($1, 'settings.group_type.deleted', 'group_type', $2, $3);
        `,
        [auth.context.personId, String(id), getClientIp(request)],
      );
      return "deleted" as const;
    });

    if (outcome === "not_found") return failure("not_found", "Group not found");
    if (outcome === "system") return failure("forbidden", "Built-in groups can't be deleted");
    if (typeof outcome === "object") {
      return failure(
        "conflict",
        `${outcome.inUse} group${outcome.inUse === 1 ? " uses" : "s use"} this type, so it can't be deleted`,
      );
    }
    return success({ ok: true });
  } catch (error) {
    // A group was given this type while it was being deleted: the foreign key stops the delete.
    const pg = error as { code?: string; driverError?: { code?: string } } | null;
    if (pg?.code === "23503" || pg?.driverError?.code === "23503") {
      return failure("conflict", "A group uses this type, so it can't be deleted");
    }
    console.error("[/api/settings/groups/[groupTypeId]] DELETE failed", error);
    return internalError();
  }
}
