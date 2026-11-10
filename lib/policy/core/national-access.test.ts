import { describe, expect, it } from "vitest";
import { givesNationalAccess } from "./national-access";

const NO_AREA = { stateId: null, lgaId: null, wardId: null, politicalUnitId: null };

describe("givesNationalAccess", () => {
  it("is national for a national type with no area on the membership", () => {
    expect(givesNationalAccess("national", NO_AREA)).toBe(true);
  });

  it("lets any area on the membership win over a national type", () => {
    expect(givesNationalAccess("national", { ...NO_AREA, stateId: 24 })).toBe(false);
    expect(givesNationalAccess("national", { ...NO_AREA, lgaId: 7 })).toBe(false);
    expect(givesNationalAccess("national", { ...NO_AREA, wardId: 3 })).toBe(false);
    expect(givesNationalAccess("national", { ...NO_AREA, politicalUnitId: 155 })).toBe(false);
  });

  it("is never national for an own-area type, or with no type", () => {
    expect(givesNationalAccess("own_area", NO_AREA)).toBe(false);
    expect(givesNationalAccess(null, NO_AREA)).toBe(false);
    expect(givesNationalAccess(undefined, NO_AREA)).toBe(false);
  });
});
