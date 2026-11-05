import type { EntityManager } from "typeorm";
import { getVisibleOwners } from "./owners";
import type { PolicyUser } from "./policy-user";

export interface OwnerGroupDto {
  id: number;
  name: string;
  type: string;
}

interface GroupRow {
  id: number | string;
  group_name: string;
  group_type: string;
}

/**
 * Groups the user may see as agent owners (the "Sponsor / owner" filter).
 * Same visibility rule as the agents list: admins and users with no viewer group see every
 * group; everyone else sees only groups their own groups are granted to view.
 * Admin groups never own agents, so they are left out.
 */
export async function listOwnerGroups(
  user: PolicyUser,
  manager: EntityManager,
): Promise<OwnerGroupDto[]> {
  const visibleOwners = getVisibleOwners(user, manager);

  const rows =
    visibleOwners.kind === "all"
      ? await manager.query<GroupRow[]>(
          `SELECT g.id, g.group_name, g.group_type
           FROM groups g
           WHERE g.group_type <> 'admin'
           ORDER BY g.group_type, g.group_name`,
        )
      : await manager.query<GroupRow[]>(
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

  return rows.map((row) => ({
    id: Number(row.id),
    name: row.group_name,
    type: row.group_type,
  }));
}
