import { describe, expect, it } from "vitest";
import { buildBoundaries, checkCoordinate } from "./inec-coordinate-validation";

const square = (name: string, x: number, y: number, size: number) => ({
  type: "Feature",
  properties: { shapeName: name },
  geometry: {
    type: "Polygon",
    coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]],
  },
});

// Two 2-degree states side by side; "Alpha" holds LGAs "Beta" and "Gamma", "Delta" holds a second "Beta".
const adm1 = JSON.stringify({
  features: [square("Alpha", 0, 0, 2), square("Delta", 2, 0, 2)],
});
const adm2 = JSON.stringify({
  features: [
    square("Beta", 0, 0, 1),
    square("Gamma", 1, 0, 1),
    square("Beta", 2, 0, 1),
  ],
});
const boundaries = buildBoundaries(adm1, adm2);

describe("coordinate boundary validation", () => {
  it("accepts a point inside its own LGA", () => {
    expect(checkCoordinate(boundaries, { stateName: "ALPHA", lgaName: "BETA" }, 0.5, 0.5)).toEqual({ ok: true });
  });

  it("rejects a point that sits in another state", () => {
    const result = checkCoordinate(boundaries, { stateName: "ALPHA", lgaName: "BETA" }, 3.5, 0.5);
    expect(result).toMatchObject({ ok: false, reason: "outside_state" });
  });

  it("tolerates a point just across the state line", () => {
    expect(checkCoordinate(boundaries, { stateName: "ALPHA", lgaName: "GAMMA" }, 2.005, 1)).toEqual({ ok: true });
  });

  it("matches same-named LGAs by parent state, not by name alone", () => {
    expect(checkCoordinate(boundaries, { stateName: "DELTA", lgaName: "Beta" }, 2.5, 0.5)).toEqual({ ok: true });
  });

  it("only checks the state when the LGA name has no boundary match", () => {
    expect(checkCoordinate(boundaries, { stateName: "ALPHA", lgaName: "UNKNOWN" }, 1.9, 1.9)).toEqual({ ok: true });
  });
});
