import { describe, expect, it } from "vitest";
import { decodeGapsCursor, encodeGapsCursor } from "./gaps-cursor";

describe("gaps cursor", () => {
  it("round-trips the sort position", () => {
    const cursor = { stateName: "ABIA", lgaName: "ABA NORTH", wardName: "ARIARIA MARKET", code: "01/01/09/006", id: 336 };
    expect(decodeGapsCursor(encodeGapsCursor(cursor))).toEqual(cursor);
  });

  it("refuses anything else", () => {
    expect(decodeGapsCursor("not a cursor!")).toBeNull();
    expect(decodeGapsCursor(Buffer.from(JSON.stringify(["A", "B", "C", "D"])).toString("base64url"))).toBeNull();
    expect(decodeGapsCursor(Buffer.from(JSON.stringify(["A", "B", "C", "D", -1])).toString("base64url"))).toBeNull();
    expect(decodeGapsCursor(Buffer.from(JSON.stringify(["A", "B", 3, "D", 1])).toString("base64url"))).toBeNull();
  });
});
