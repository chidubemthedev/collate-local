import { describe, expect, it } from "vitest";
import { parseCoverageFilters } from "./filters";

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
});
