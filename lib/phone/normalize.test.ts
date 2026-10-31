import { describe, expect, it } from "vitest";
import { toE164 } from "./normalize";

describe("toE164", () => {
  it("normalizes a local Nigerian mobile number", () => {
    expect(toE164("0800 000 0000")).toBe("+234 800 000 0000");
  });

  it("accepts a valid international format", () => {
    expect(toE164("+2348030000000")).toBe("+234 803 000 0000");
  });

  it("accepts a country-code-only format", () => {
    expect(toE164("2348030000000")).toBe("+234 803 000 0000");
  });

  it("removes dashes and whitespace before normalizing", () => {
    expect(toE164("0803-000-0000")).toBe("+234 803 000 0000");
  });

  it("returns null for invalid values", () => {
    expect(toE164("12345")).toBeNull();
    expect(toE164("abc")).toBeNull();
  });
});
