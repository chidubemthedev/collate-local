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

export function getVisibleOwners(user: PolicyUser, _manager?: EntityManager): VisibleOwners {
  void _manager;
  // Admins and party (national) accounts see agents of every owner.
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

      // ASSUMPTION: group hierarchy inheritance is not applied in v1.
      // ASSUMPTION: candidate-owned assignments are governed by scope only.
      queryBuilder.andWhere(
        new Brackets((where) => {
          where
            .where(`${ownerGroupColumn} IS NULL`)
            .orWhere(`${ownerGroupColumn} IN (${grants})`);
        }),
        { [parameter]: user.groupIds },
      );
    },
  };
}
