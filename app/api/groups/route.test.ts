import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "@/lib/auth/errors";

// The first test also pays for loading the route module (several seconds on a cold run).
vi.setConfig({ testTimeout: 20_000 });

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  requireUser: vi.fn(),
  policyUserFromCurrentUser: vi.fn(),
  listOwnerGroups: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/server", () => ({
  connection: mocks.connection,
}));

vi.mock("@/lib/auth/current-user", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/policy", () => ({
  policyUserFromCurrentUser: mocks.policyUserFromCurrentUser,
  listOwnerGroups: mocks.listOwnerGroups,
}));

const user = {
  personId: "11111111-1111-4111-8111-111111111111",
  isAdmin: false,
  candidateId: null,
  seatId: null,
  groupIds: [5, 9],
  scopeUnits: { stateIds: [], lgaIds: [], wardIds: [], politicalUnitIds: [] },
};

describe("GET /api/groups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connection.mockResolvedValue(undefined);
    mocks.requireUser.mockResolvedValue({ personId: user.personId });
    mocks.policyUserFromCurrentUser.mockResolvedValue(user);
    mocks.listOwnerGroups.mockResolvedValue([]);
  });

  it("returns the groups the user may see, in a success envelope", async () => {
    mocks.listOwnerGroups.mockResolvedValue([
      { id: 3, name: "NDC Party", type: "party" },
      { id: 4, name: "Mobilisers", type: "support_group" },
    ]);

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "success",
      data: [
        { id: 3, name: "NDC Party", type: "party" },
        { id: 4, name: "Mobilisers", type: "support_group" },
      ],
    });
    expect(mocks.listOwnerGroups).toHaveBeenCalledWith(user);
  });

  it("returns an empty list when nothing is visible", async () => {
    const { GET } = await import("./route");
    const response = await GET();

    await expect(response.json()).resolves.toEqual({ status: "success", data: [] });
  });

  it("returns 401 without a session", async () => {
    mocks.requireUser.mockRejectedValue(new UnauthorizedError());

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.listOwnerGroups).not.toHaveBeenCalled();
  });

  it("returns 500 when the lookup fails", async () => {
    mocks.listOwnerGroups.mockRejectedValue(new Error("database down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(500);
    consoleError.mockRestore();
  });
});
