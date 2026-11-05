import { describe, expect, it } from "vitest";
import { audienceFilterSchema, createBroadcastSchema } from "./schemas";

describe("audienceFilterSchema", () => {
  it("defaults the agent kind to all and accepts positive integer IDs", () => {
    const parsed = audienceFilterSchema.parse({
      stateId: "4",
      wardId: 12,
      politicalUnitId: 3,
      ownerGroupId: 7,
      pollingUnitId: 22,
    });
    expect(parsed).toEqual({
      stateId: 4,
      wardId: 12,
      politicalUnitId: 3,
      ownerGroupId: 7,
      pollingUnitId: 22,
      agentKind: "all",
    });
  });

  it("rejects unknown keys, invalid IDs and unknown agent kinds", () => {
    expect(audienceFilterSchema.safeParse({ lgaId: 0 }).success).toBe(false);
    expect(audienceFilterSchema.safeParse({ lgaId: "x" }).success).toBe(false);
    expect(audienceFilterSchema.safeParse({ agentKind: "coordinator" }).success).toBe(false);
    expect(audienceFilterSchema.safeParse({ ownerCandidateId: 2 }).success).toBe(false);
    expect(audienceFilterSchema.safeParse({ verificationStatus: "pending" }).success).toBe(false);
  });

  it("accepts polling unit and person verification filters", () => {
    for (const verificationStatus of ["unverified", "verified", "rejected"]) {
      expect(
        audienceFilterSchema.parse({
          pollingUnitId: "12",
          verificationStatus,
        }),
      ).toMatchObject({ pollingUnitId: 12, verificationStatus });
    }
  });
});

describe("createBroadcastSchema", () => {
  it("trims message text and accepts a near-future schedule", () => {
    const parsed = createBroadcastSchema.parse({
      audienceFilter: {},
      messageText: "  Polling unit update  ",
      scheduledSendAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(parsed.messageText).toBe("Polling unit update");
  });

  it("rejects empty or overlong messages and control characters", () => {
    expect(createBroadcastSchema.safeParse({ audienceFilter: {}, messageText: "   " }).success).toBe(false);
    expect(
      createBroadcastSchema.safeParse({ audienceFilter: {}, messageText: "x".repeat(1001) }).success,
    ).toBe(false);
    expect(
      createBroadcastSchema.safeParse({ audienceFilter: {}, messageText: "bad\u0000text" }).success,
    ).toBe(false);
  });

  it("rejects past schedules and schedules beyond 90 days", () => {
    for (const offset of [-60_000, 91 * 24 * 60 * 60 * 1000]) {
      expect(
        createBroadcastSchema.safeParse({
          audienceFilter: {},
          messageText: "Update",
          scheduledSendAt: new Date(Date.now() + offset).toISOString(),
        }).success,
      ).toBe(false);
    }
  });
});
