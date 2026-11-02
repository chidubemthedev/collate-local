import { describe, expect, it } from "vitest";
import { parseOkCallback } from "./ok";

const deliveryId = "0b3f6f9e-5c47-4b8e-9f4b-2f5b5a6c7d8e";

describe("parseOkCallback", () => {
  it("accepts only ok:<uuid>", () => {
    expect(parseOkCallback(`ok:${deliveryId}`)).toBe(deliveryId);
    expect(parseOkCallback("ok:not-a-uuid")).toBeNull();
    expect(parseOkCallback(`tap:${deliveryId}`)).toBeNull();
    expect(parseOkCallback(`ok:${deliveryId}:extra`)).toBeNull();
    expect(parseOkCallback(undefined)).toBeNull();
    expect(parseOkCallback("")).toBeNull();
  });
});
