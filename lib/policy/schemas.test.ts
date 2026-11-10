import { describe, expect, it } from "vitest";
import { agentFiltersSchema } from "./schemas";

describe("agent filters schema", () => {
  it("defaults the page size and accepts a limit up to 100", () => {
    expect(agentFiltersSchema.parse({}).limit).toBe(50);
    expect(agentFiltersSchema.parse({ limit: "100" }).limit).toBe(100);
  });

  it("accepts a person id and rejects one that is not a uuid", () => {
    expect(agentFiltersSchema.parse({ personId: "11111111-1111-4111-8111-111111111111" }).personId).toBe("11111111-1111-4111-8111-111111111111");
    expect(agentFiltersSchema.safeParse({ personId: "Samixx Yasuke" }).success).toBe(false);
  });

  it("rejects limits above 100 and invalid cursors", () => {
    expect(agentFiltersSchema.safeParse({ limit: "101" }).success).toBe(false);
    expect(agentFiltersSchema.safeParse({ cursor: "bad" }).success).toBe(false);
  });
});
