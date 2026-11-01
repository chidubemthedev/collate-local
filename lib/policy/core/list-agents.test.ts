import { describe, expect, it } from "vitest";
import { maskPhoneNumber, validateAgentFilters } from "./list-agents";
import { InvalidFilterError } from "../errors";
import type { PolicyUser } from "./policy-user";

const candidateUser: PolicyUser = {
  personId: "person-id",
  isAdmin: false,
  candidateId: 1,
  seatId: 1,
  groupIds: [],
  scopeUnits: { stateIds: [], lgaIds: [], wardIds: [], politicalUnitIds: [] },
};

describe("agent policy filters and phone masking", () => {
  it("keeps the country code and last four digits only", () => {
    expect(maskPhoneNumber("+2348012345678")).toBe("+234******5678");
    expect(maskPhoneNumber(null)).toBeNull();
  });

  it("rejects LGA filters for non-admin candidates", () => {
    expect(() => validateAgentFilters(candidateUser, { lgaId: 1, limit: 50 })).toThrow(
      InvalidFilterError,
    );
    expect(() => validateAgentFilters(candidateUser, { wardId: 1, limit: 50 })).not.toThrow();
  });
});
