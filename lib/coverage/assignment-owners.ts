import { groupsAndDescendantsSql } from "@/lib/policy/core/owners";

/**
 * Who an agent can be assigned for. One rule, shared by POST /api/coverage/assignments (the check)
 * and GET /api/coverage/assignments/owners (the Owner dropdown), so the dropdown never offers an
 * owner the check would reject.
 *
 * A group, when its type can own agents and the person is an admin, has no membership at all,
 * belongs to that group or any group above it (parents assign for their children, grandchildren, ...),
 * or belongs to a group granted visibility of it.
 *
 * `owner_group` / `owner_type` are the group and its type. `personParam` and `isAdminParam` are
 * placeholders such as "$1" and "$3".
 */
export function assignableGroupSql(personParam: string, isAdminParam: string): string {
  const ownTree = groupsAndDescendantsSql(
    `seed_group.id IN (SELECT own_membership.group_id FROM membership own_membership WHERE own_membership.person_id = ${personParam})`,
  );
  return `owner_type.can_own_agents
    AND (
      ${isAdminParam}::boolean
      OR NOT EXISTS (
        SELECT 1 FROM membership viewer_membership WHERE viewer_membership.person_id = ${personParam}
      )
      OR owner_group.id IN (${ownTree})
      OR EXISTS (
        SELECT 1
        FROM membership viewer_membership
        JOIN group_visibility_grant visibility ON visibility.viewer_group_id = viewer_membership.group_id
        WHERE viewer_membership.person_id = ${personParam}
          AND visibility.owner_group_id = owner_group.id
          AND visibility.is_allowed = TRUE
      )
    )`;
}

/** A candidate owner: only the candidate themself. `c` is the candidate. */
export function assignableCandidateSql(personParam: string): string {
  return `c.person_id = ${personParam}`;
}
