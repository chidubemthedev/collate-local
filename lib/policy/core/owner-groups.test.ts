import { describe, expect, it, vi } from "vitest";
import type { EntityManager } from "typeorm";
import { listOwnerGroups } from "./owner-groups";
import type { PolicyUser } from "./policy-user";

const baseUser: PolicyUser = {
  personId: "11111111-1111-4111-8111-111111111111",
  isAdmin: false,
  candidateId: null,
  seatId: null,
  groupIds: [5, 9],
  scopeUnits: { stateIds: [], lgaIds: [], wardIds: [], politicalUnitIds: [] },
};

function managerReturning(rows: unknown[]) {
  const query = vi.fn(async () => rows);
  return { query, manager: { query } as unknown as EntityManager };
}

describe("listOwnerGroups", () => {
  it("gives admins every group whose type can own agents, without the visibility grants", async () => {
    const { query, manager } = managerReturning([
      { id: "3", group_name: "NDC Party", group_type: "party" },
      { id: 4, group_name: "Mobilisers", group_type: "support_group" },
    ]);

    const groups = await listOwnerGroups({ ...baseUser, isAdmin: true }, manager);

    expect(groups).toEqual([
      { id: 3, name: "NDC Party", type: "party" },
      { id: 4, name: "Mobilisers", type: "support_group" },
    ]);
    const [sql, parameters] = query.mock.calls[0] as unknown as [string, unknown[] | undefined];
    expect(sql).toContain("gt.can_own_agents");
    expect(sql).not.toContain("group_visibility_grant");
    expect(parameters).toBeUndefined();
  });

  it("treats a user with no viewer group like an admin (same rule as the agents list)", async () => {
    const { query, manager } = managerReturning([]);

    await listOwnerGroups({ ...baseUser, groupIds: [] }, manager);

    const [sql] = query.mock.calls[0] as unknown as [string];
    expect(sql).not.toContain("group_visibility_grant");
  });

  it("limits other users to their own groups, the groups below them and those they are granted", async () => {
    const { query, manager } = managerReturning([]);

    await listOwnerGroups(baseUser, manager);

    const [sql, parameters] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("group_visibility_grant");
    expect(sql).toContain("is_allowed = TRUE");
    expect(sql).toContain("WITH RECURSIVE group_tree");
    expect(sql).toContain("seed_group.id = ANY($1::int[])");
    expect(sql).toContain("child_group.parent_group_id = parent_group.id");
    expect(sql).toContain("gt.can_own_agents");
    expect(parameters).toEqual([[5, 9]]);
  });
});
