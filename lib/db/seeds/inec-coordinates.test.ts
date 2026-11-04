import { describe, expect, it } from "vitest";
import {
  makePollingUnitKey,
  normalizeLocationName,
  parseCoordinateCsv,
  parseCoordinatePair,
  parseCsv,
} from "./inec-coordinates";

describe("INEC coordinate CSV helpers", () => {
  it("parses quoted commas, escaped quotes, and CRLF rows", () => {
    expect(parseCsv('name,location\r\n"School, One","The ""Main"" Hall"\r\n')).toEqual([
      ["name", "location"],
      ["School, One", 'The "Main" Hall'],
    ]);
  });

  it("requires the expected columns and maps them by header name", () => {
    expect(
      parseCoordinateCsv(
        "state_name,name,ward_name,local_government_name,location.longitude,location.latitude\n" +
          'KOGI,"SCHOOL, ONE",WARD,AREA,7.5,7.2\n',
      ),
    ).toEqual([
      {
        name: "SCHOOL, ONE",
        wardName: "WARD",
        lgaName: "AREA",
        stateName: "KOGI",
        latitude: "7.2",
        longitude: "7.5",
      },
    ]);
  });

  it("normalizes names and creates a key from the full hierarchy", () => {
    expect(normalizeLocationName(" St. Peter's School & Hall ")).toBe("st peter s school and hall");
    expect(makePollingUnitKey(["Kogi", "A LGA", "Ward 1", "School"])).toBe(
      makePollingUnitKey(["KOGI", "A LGA", "WARD-1", "SCHOOL"]),
    );
  });

  it("rejects missing, malformed, and obviously out-of-country coordinate pairs", () => {
    expect(parseCoordinatePair("", "")).toEqual({ valid: false, reason: "missing" });
    expect(parseCoordinatePair("7.5", "")).toEqual({ valid: false, reason: "invalid" });
    expect(parseCoordinatePair("43.4", "-80.5")).toEqual({ valid: false, reason: "outside_bounds" });
    expect(parseCoordinatePair("not-a-number", "7")).toEqual({ valid: false, reason: "invalid" });
    expect(parseCoordinatePair("7.5", "7.2")).toEqual({ valid: true, latitude: 7.5, longitude: 7.2 });
  });
});
