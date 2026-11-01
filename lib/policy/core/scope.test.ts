import { DataSource } from "typeorm";
import { describe, expect, it } from "vitest";
import { getScope } from "./scope";
import type { PolicyUser } from "./policy-user";

const restrictedUser: PolicyUser = {
  personId: "person-id",
  isAdmin: false,
  candidateId: null,
  seatId: 99,
  groupIds: [],
  scopeUnits: {
    stateIds: [17],
    lgaIds: [18],
    wardIds: [19],
    politicalUnitIds: [20],
  },
};

describe("policy scope", () => {
  it("keeps polling unit ids in a SQL subquery and parameters to the user's scope", () => {
    const dataSource = new DataSource({ type: "postgres", entities: [] });
    const query = dataSource.createQueryBuilder().select("pu.id").from("polling_unit", "pu");
    const scope = getScope(restrictedUser);

    scope.apply(query, "pu.id");

    expect(scope.kind).toBe("restricted");
    expect(query.getQuery()).toContain("UNION");
    expect(Object.values(query.getParameters())).toEqual([99, 17, 18, 19, 20]);
  });

  it("fails closed when the user has no scope source", () => {
    const dataSource = new DataSource({ type: "postgres", entities: [] });
    const query = dataSource.createQueryBuilder().select("pu.id").from("polling_unit", "pu");
    const scope = getScope({
      ...restrictedUser,
      seatId: null,
      scopeUnits: { stateIds: [], lgaIds: [], wardIds: [], politicalUnitIds: [] },
    });

    scope.apply(query, "pu.id");

    expect(scope.kind).toBe("none");
    expect(query.getQuery()).toContain("FALSE");
  });
});
