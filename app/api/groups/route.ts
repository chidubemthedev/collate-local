import "server-only";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { getDataSource } from "@/lib/db";
import { internalError, success } from "@/lib/api/response";
import { policyErrorResponse } from "@/lib/policy/http";
import { getVisibleOwners, policyUserFromCurrentUser } from "@/lib/policy";

interface GroupRow {
  id: number;
  group_name: string;
  group_type: string;
}

/**
 * Groups the user may see as agent owners (the "Sponsor / owner" filter).
 * Uses the same visibility rule as /api/agents: admins and users with no viewer group see
 * every group; everyone else sees only groups their own groups are granted to view.
 * Admin groups never own agents, so they are left out.
 */
export async function GET(): Promise<Response> {
  await connection();

  try {
    const currentUser = await requireUser();
    const user = await policyUserFromCurrentUser(currentUser);
    const visibleOwners = getVisibleOwners(user);
    const dataSource = await getDataSource();

    const rows =
      visibleOwners.kind === "all"
        ? await dataSource.query<GroupRow[]>(
            `SELECT g.id, g.group_name, g.group_type
             FROM groups g
             WHERE g.group_type <> 'admin'
             ORDER BY g.group_type, g.group_name`,
          )
        : await dataSource.query<GroupRow[]>(
            `SELECT DISTINCT g.id, g.group_name, g.group_type
             FROM groups g
             JOIN group_visibility_grant grant_row
               ON grant_row.owner_group_id = g.id
              AND grant_row.is_allowed = TRUE
             WHERE grant_row.viewer_group_id = ANY($1::int[])
               AND g.group_type <> 'admin'
             ORDER BY g.group_type, g.group_name`,
            [user.groupIds],
          );

    return success(
      rows.map((row) => ({
        id: Number(row.id),
        name: row.group_name,
        type: row.group_type,
      })),
    );
  } catch (error) {
    const response = policyErrorResponse(error);
    if (response) return response;
    console.error("[/api/groups] request failed", error);
    return internalError();
  }
}
