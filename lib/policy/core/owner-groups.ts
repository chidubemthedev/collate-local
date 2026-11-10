import type { EntityManager } from "typeorm";
import { getVisibleOwners, groupsAndDescendantsSql } from "./owners";
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
 * Same visibility rule as the agents list: admins, national accounts and users with no viewer
 * group see every group; everyone else sees their own groups, every group below them, and those
 * they are granted to view.
 * Only groups whose type can own agents are listed (not admin groups).
 */
export async function listOwnerGroups(
  user: PolicyUser,
  manager: EntityManager,
): Promise<OwnerGroupDto[]> {
  const visibleOwners = getVisibleOwners(user, manager);

  const rows =
    visibleOwners.kind === "all"
      ? await manager.query<GroupRow[]>(
          `SELECT g.id, g.group_name, COALESCE(gt.type_key, gt.type_name) AS group_type
           FROM groups g
           JOIN group_type gt ON gt.id = g.group_type_id
           WHERE gt.can_own_agents
           ORDER BY gt.id, g.group_name`,
        )
      : await manager.query<GroupRow[]>(
          `SELECT g.id, g.group_name, COALESCE(gt.type_key, gt.type_name) AS group_type
           FROM groups g
           JOIN group_type gt ON gt.id = g.group_type_id
           WHERE gt.can_own_agents
             AND (
               g.id IN (${groupsAndDescendantsSql("seed_group.id = ANY($1::int[])")})
               OR EXISTS (
                 SELECT 1
                 FROM group_visibility_grant grant_row
                 WHERE grant_row.owner_group_id = g.id
                   AND grant_row.is_allowed = TRUE
                   AND grant_row.viewer_group_id = ANY($1::int[])
               )
             )
           ORDER BY gt.id, g.group_name`,
          [user.groupIds],
        );

  return rows.map((row) => ({
    id: Number(row.id),
    name: row.group_name,
    type: row.group_type,
  }));
}
