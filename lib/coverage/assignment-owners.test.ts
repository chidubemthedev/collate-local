import { describe, expect, it } from "vitest";
import { assignableCandidateSql, assignableGroupSql } from "./assignment-owners";

describe("assignableGroupSql", () => {
  const sql = assignableGroupSql("$1", "$3");

  it("only offers groups whose type can own agents", () => {
    expect(sql.startsWith("owner_type.can_own_agents")).toBe(true);
  });

  it("lets admins and people with no membership assign for any group", () => {
    expect(sql).toContain("$3::boolean");
    expect(sql).toMatch(/NOT EXISTS \(\s*SELECT 1 FROM membership viewer_membership WHERE viewer_membership\.person_id = \$1/);
  });

  it("covers the person's own groups and every group below them", () => {
    expect(sql).toContain("WITH RECURSIVE group_tree");
    expect(sql).toContain("own_membership.person_id = $1");
    expect(sql).toContain("child_group.parent_group_id = parent_group.id");
  });

  it("covers groups the person's groups are granted to see", () => {
    expect(sql).toContain("visibility.owner_group_id = owner_group.id");
    expect(sql).toContain("visibility.is_allowed = TRUE");
  });
});

describe("assignableCandidateSql", () => {
  it("only lets candidates assign for themselves", () => {
    expect(assignableCandidateSql("$1")).toBe("c.person_id = $1");
  });
});
