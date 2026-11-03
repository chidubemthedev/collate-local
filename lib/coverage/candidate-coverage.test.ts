import { describe, expect, it } from "vitest";
import { decodeCandidateCoverageCursor } from "./candidate-coverage";

describe("decodeCandidateCoverageCursor", () => {
  it("decodes a level.id cursor", () => {
    expect(decodeCandidateCoverageCursor("2.15")).toEqual({ level: 2, id: 15 });
  });

  it("rejects malformed cursors", () => {
    expect(decodeCandidateCoverageCursor("abc")).toBeNull();
    expect(decodeCandidateCoverageCursor("1.2.3")).toBeNull();
    expect(decodeCandidateCoverageCursor("1; DROP")).toBeNull();
  });
});
