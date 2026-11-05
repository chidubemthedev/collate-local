import { describe, expect, it } from "vitest";
import { gpsFilterSql } from "../geography/gps";
import { parseCoverageFilters, parseCoverageGpsFilter } from "./filters";

describe("parseCoverageFilters", () => {
  it("builds parameterized filters in a stable order", () => {
    const result = parseCoverageFilters(
      new URLSearchParams("wardId=12&stateId=3&politicalUnitId=8"),
      6,
    );

    expect(result).toEqual({
      clauses: [
        "s.id = $6",
        "w.id = $7",
        `EXISTS (
      SELECT 1 FROM pu_political_unit filter_ppu
      WHERE filter_ppu.polling_unit_id = pu.id
        AND filter_ppu.political_unit_id = $8
    )`,
      ],
      parameters: [3, 12, 8],
    });
  });

  it.each(["0", "-1", "1.5", "not-a-number"])("rejects invalid IDs: %s", (value) => {
    const result = parseCoverageFilters(new URLSearchParams(`lgaId=${value}`), 1);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(400);
    }
  });

  it("allows an empty filter set", () => {
    expect(parseCoverageFilters(new URLSearchParams(), 1)).toEqual({
      clauses: [],
      parameters: [],
    });
  });

  it.each([
    ["all", null],
    ["with", "(pu.latitude IS NOT NULL AND pu.longitude IS NOT NULL AND NOT (pu.latitude = 0 AND pu.longitude = 0))"],
    ["without", "NOT (pu.latitude IS NOT NULL AND pu.longitude IS NOT NULL AND NOT (pu.latitude = 0 AND pu.longitude = 0))"],
  ] as const)("parses GPS mode %s", (gps, clause) => {
    const result = parseCoverageGpsFilter(new URLSearchParams(`gps=${gps}`));
    expect(result).toBe(gps);
    expect(gpsFilterSql(gps, "pu")).toBe(clause);
  });

  it("defaults GPS mode to all and rejects unknown modes", () => {
    expect(parseCoverageGpsFilter(new URLSearchParams())).toBe("all");
    const invalid = parseCoverageGpsFilter(new URLSearchParams("gps=unknown"));
    expect(invalid).toBeNull();
  });
});
