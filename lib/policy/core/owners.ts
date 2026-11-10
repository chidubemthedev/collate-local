import { Brackets } from "typeorm";
import type { ObjectLiteral, SelectQueryBuilder } from "typeorm";
import type { EntityManager } from "typeorm";
import type { PolicyUser } from "./policy-user";

export interface VisibleOwners {
  kind: "all" | "restricted";
  apply<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    ownerGroupColumn: string,
  ): void;
}

let ownerSequence = 0;

/**
 * SQL for the ids of some groups plus every group below them (children, grandchildren, ...),
 * following `groups.parent_group_id`. `seedCondition` picks the starting groups from `seed_group`.
 * UNION (not UNION ALL) drops repeats, so a parent loop in the data cannot recurse forever.
 */
export function groupsAndDescendantsSql(seedCondition: string): string {
  return `WITH RECURSIVE group_tree(id) AS (
          SELECT seed_group.id FROM groups seed_group WHERE ${seedCondition}
          UNION
          SELECT child_group.id
          FROM groups child_group
          JOIN group_tree parent_group ON child_group.parent_group_id = parent_group.id
        )
        SELECT group_tree.id FROM group_tree`;
}

export function getVisibleOwners(user: PolicyUser, _manager?: EntityManager): VisibleOwners {
  void _manager;
  // Admins and national accounts see agents of every owner.
  if (user.isAdmin || user.hasNationalAccess || user.groupIds.length === 0) {
    // ASSUMPTION: candidate-only users have no viewer group, so they see all group owners.
    return { kind: "all", apply: () => undefined };
  }

  return {
    kind: "restricted",
    apply: (queryBuilder, ownerGroupColumn) => {
      const parameter = `policyVisibleOwnerGroupIds${++ownerSequence}`;
      const grants = `SELECT visibility_grant.owner_group_id
        FROM group_visibility_grant visibility_grant
        WHERE visibility_grant.viewer_group_id IN (:...${parameter})
          AND visibility_grant.is_allowed = TRUE`;

      const ownTree = groupsAndDescendantsSql(`seed_group.id IN (:...${parameter})`);

      // ASSUMPTION: candidate-owned assignments are governed by scope only.
      // A group sees its own agents and those of every group below it (children, grandchildren, ...),
      // plus those of groups it has been granted.
      queryBuilder.andWhere(
        new Brackets((where) => {
          where
            .where(`${ownerGroupColumn} IS NULL`)
            .orWhere(`${ownerGroupColumn} IN (${ownTree})`)
            .orWhere(`${ownerGroupColumn} IN (${grants})`);
        }),
        { [parameter]: user.groupIds },
      );
    },
  };
}
