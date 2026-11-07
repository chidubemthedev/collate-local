import "server-only";
import { connection } from "next/server";
import { readOnlyResponse, requireApiAuth } from "@/lib/auth/api";
import { assertSameOrigin, getClientIp } from "@/lib/auth/request";
import { failure, internalError, success } from "@/lib/api/response";
import {
  GROUP_TYPE_NAME_MAX,
  NEW_TYPE_CAN_MESSAGE,
  SEES_COVERAGE_VALUES,
  type CanMessage,
  type NewTypeCanMessage,
  type SeesCoverage,
} from "@/lib/settings/group-access";
import type { GroupAccessRule } from "@/types/api";

type GroupTypeRow = {
  id: number;
  type_key: string | null;
  type_name: string;
  can_message: CanMessage;
  sees_coverage: SeesCoverage;
  can_own_agents: boolean;
  is_system: boolean;
};

const SELECT_COLUMNS = `id, type_key, type_name, can_message::text AS can_message,
  sees_coverage::text AS sees_coverage, can_own_agents, is_system`;

function toRule(row: GroupTypeRow): GroupAccessRule {
  return {
    id: Number(row.id),
    key: row.type_key,
    name: row.type_name,
    canMessage: row.can_message,
    seesCoverage: row.sees_coverage,
    canOwnAgents: row.can_own_agents,
    isSystem: row.is_system,
  };
}

/** Settings · Groups and access: every group type and what it can do. Admins only. */
export async function GET() {
  await connection();

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;
    // While "View as" is on, isAdmin follows the previewed access, so a preview of a
    // non-admin is refused here too.
    if (!auth.context.isAdmin) {
      return failure("forbidden", "Only admins can manage groups and access");
    }

    const rows = await auth.context.dataSource.query<GroupTypeRow[]>(
      `SELECT ${SELECT_COLUMNS} FROM group_type ORDER BY is_system DESC, id;`,
    );
    return success(rows.map(toRule));
  } catch (error) {
    console.error("[/api/settings/groups] GET failed", error);
    return internalError();
  }
}

/** Creates a group type. Body: { name, canMessage: "none" | "agents_they_cover", seesCoverage: "national" | "own_area" }. */
export async function POST(request: Request) {
  await connection();
  try {
    assertSameOrigin(request);
  } catch {
    return failure("invalid_origin", "Request origin is not allowed");
  }

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;
    if (auth.context.viewAs) return readOnlyResponse();
    if (!auth.context.isAdmin) {
      return failure("forbidden", "Only admins can manage groups and access");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure("validation_failed", "Invalid JSON request body");
    }
    const input = (body ?? {}) as { name?: unknown; canMessage?: unknown; seesCoverage?: unknown };
    const fields: Record<string, string> = {};
    const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
    if (!name) fields.name = "Enter a name for the group";
    else if (name.length > GROUP_TYPE_NAME_MAX) fields.name = `Use ${GROUP_TYPE_NAME_MAX} characters or fewer`;
    if (!NEW_TYPE_CAN_MESSAGE.includes(input.canMessage as NewTypeCanMessage)) {
      fields.canMessage = "Choose who this group can message";
    }
    if (!SEES_COVERAGE_VALUES.includes(input.seesCoverage as SeesCoverage)) {
      fields.seesCoverage = "Choose what coverage this group sees";
    }
    if (Object.keys(fields).length) return failure("validation_failed", "Check the group details", fields);

    const created = await auth.context.dataSource.transaction(async (manager) => {
      const [row] = (await manager.query(
        `
          INSERT INTO group_type (type_key, type_name, can_message, sees_coverage, can_own_agents, is_system)
          VALUES (NULL, $1, $2::group_can_message, $3::group_sees_coverage, TRUE, FALSE)
          ON CONFLICT DO NOTHING
          RETURNING ${SELECT_COLUMNS};
        `,
        [name, input.canMessage, input.seesCoverage],
      )) as GroupTypeRow[];
      if (!row) return null;
      await manager.query(
        `
          INSERT INTO audit_log
            (actor_person_id, action_type, target_entity_type, target_entity_id, ip_address)
          VALUES ($1, 'settings.group_type.created', 'group_type', $2, $3);
        `,
        [auth.context.personId, String(row.id), getClientIp(request)],
      );
      return row;
    });

    if (!created) return failure("conflict", "A group with this name already exists");
    return success(toRule(created), undefined, 201);
  } catch (error) {
    console.error("[/api/settings/groups] POST failed", error);
    return internalError();
  }
}
