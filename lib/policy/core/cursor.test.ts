import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./cursor";

const cursor = {
  pollingUnitCode: "90-01-01-001",
  slotNumber: 2,
  assignmentId: "123e4567-e89b-12d3-a456-426614174000",
};

describe("agent cursor", () => {
  it("encodes and decodes the final sort key", () => {
    const encoded = encodeCursor(cursor);
    expect(decodeCursor(encoded)).toEqual(cursor);
  });

  it("rejects malformed or tampered cursor values", () => {
    expect(() => decodeCursor("not-a-cursor")).toThrow();
    expect(() => decodeCursor(encodeCursor({ ...cursor, slotNumber: -1 }))).toThrow();
  });
});
