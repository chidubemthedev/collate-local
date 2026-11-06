import { describe, expect, it } from "vitest";
import { getCoverageScopeFilter, type MembershipScope } from "./coverage-scope";

const ALIASES = { state: "s", lga: "l", ward: "w", pollingUnit: "pu" };
const scope = (values: Partial<MembershipScope>): MembershipScope => ({
  stateId: null,
  lgaId: null,
  wardId: null,
  politicalUnitId: null,
  ...values,
});

describe("getCoverageScopeFilter", () => {
  it("always binds the same five parameters, without duplicates", () => {
    const filter = getCoverageScopeFilter(
      {
        hasGlobalCoverageAccess: false,
        scopes: [scope({ stateId: 5 }), scope({ stateId: 5 }), scope({ lgaId: 300 })],
      },
      ALIASES,
    );
    expect(filter.parameters).toEqual([false, [5], [300], [], []]);
    for (const n of [1, 2, 3, 4, 5]) expect(filter.sql).toContain(`$${n}::`);
  });

  it("tests only the kinds of area the user has", () => {
    const { sql } = getCoverageScopeFilter(
      { hasGlobalCoverageAccess: false, scopes: [scope({ stateId: 5 })] },
      ALIASES,
    );
    expect(sql).toContain("s.id = ANY($2::int[])");
    expect(sql).toContain("($3::int[] IS NULL)");
    expect(sql).toContain("($4::int[] IS NULL)");
    expect(sql).toContain("($5::int[] IS NULL)");
    expect(sql).not.toContain("pu_political_unit");
  });

  it("keeps the full test, constituency lookup included, when the user has a constituency", () => {
    const { sql, parameters } = getCoverageScopeFilter(
      { hasGlobalCoverageAccess: false, scopes: [scope({ politicalUnitId: 40 })] },
      ALIASES,
    );
    expect(parameters).toEqual([false, [], [], [], [40]]);
    expect(sql).toContain("s.id = ANY($2::int[])");
    expect(sql).toContain("l.id = ANY($3::int[])");
    expect(sql).toContain("w.id = ANY($4::int[])");
    expect(sql).toContain("scope_ppu.polling_unit_id = pu.id");
    expect(sql).toContain("ANY($5::int[])");
  });

  it("numbers from firstParameter and uses the given aliases", () => {
    const { sql } = getCoverageScopeFilter(
      { hasGlobalCoverageAccess: true, scopes: [scope({ wardId: 9 })] },
      { state: "st", lga: "lg", ward: "wd", pollingUnit: "p" },
      3,
    );
    expect(sql).toContain("$3::boolean");
    expect(sql).toContain("wd.id = ANY($6::int[])");
    expect(sql).toContain("($7::int[] IS NULL)");
    expect(sql).not.toContain("$2");
  });
});
