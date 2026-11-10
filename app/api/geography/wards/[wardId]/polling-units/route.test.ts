import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  requireUser: vi.fn(),
  getClientIp: vi.fn(),
  listWardPollingUnits: vi.fn(),
  policyUserFromCurrentUser: vi.fn(),
}));

vi.mock("@/lib/policy", () => ({
  policyUserFromCurrentUser: mocks.policyUserFromCurrentUser,
}));

vi.mock("server-only", () => ({}));

vi.mock("next/server", () => ({
  connection: mocks.connection,
}));

vi.mock("@/lib/auth/current-user", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/auth/request", () => ({
  getClientIp: mocks.getClientIp,
}));

vi.mock("@/lib/policy/core/list-ward-polling-units", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/policy/core/list-ward-polling-units")
  >("@/lib/policy/core/list-ward-polling-units");
  return {
    ...actual,
    listWardPollingUnits: mocks.listWardPollingUnits,
  };
});

// Imported once, up front: loading the route pulls in the entities and TypeORM, which can take
// longer than a test's time limit on a cold, busy run if done inside the test.
import { GET } from "./route";

describe("ward polling unit route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listWardPollingUnits.mockClear();
    mocks.connection.mockResolvedValue(undefined);
    mocks.requireUser.mockResolvedValue({ personId: "11111111-1111-4111-8111-111111111111" });
    mocks.getClientIp.mockReturnValue("203.0.113.1");
    mocks.listWardPollingUnits.mockResolvedValue({
      items: [{ id: 1, code: "001", agents: [] }],
      nextCursor: "cursor-value",
    });
  });

  it("returns a standard paginated success envelope", async () => {
    const response = await GET(
      new Request("http://localhost/api/geography/wards/7/polling-units?limit=25"),
      { params: Promise.resolve({ wardId: "7" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.listWardPollingUnits).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      7,
      { limit: 25, gps: "all" },
      { ipAddress: "203.0.113.1" },
    );
  });

  it("lists with the previewed access while View as is on", async () => {
    const previewed = { personId: "11111111-1111-4111-8111-111111111111", seatId: 6 };
    mocks.requireUser.mockResolvedValue({
      personId: "11111111-1111-4111-8111-111111111111",
      viewAs: { kind: "seat", seatId: 6, unitId: 155, unitType: "state", label: "Candidate · Governor, Lagos" },
    });
    mocks.policyUserFromCurrentUser.mockResolvedValue(previewed);
    const response = await GET(
      new Request("http://localhost/api/geography/wards/7/polling-units"),
      { params: Promise.resolve({ wardId: "7" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.listWardPollingUnits.mock.calls[0][3]).toEqual({ ipAddress: "203.0.113.1", user: previewed });
  });

  it("returns 404 when the requested ward is outside scope", async () => {
    mocks.listWardPollingUnits.mockResolvedValue(null);
    const response = await GET(
      new Request("http://localhost/api/geography/wards/8/polling-units"),
      { params: Promise.resolve({ wardId: "8" }) },
    );

    expect(response.status).toBe(404);
  });

  it("rejects a page size above 100 before querying", async () => {
    const response = await GET(
      new Request("http://localhost/api/geography/wards/7/polling-units?limit=101"),
      { params: Promise.resolve({ wardId: "7" }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.listWardPollingUnits).not.toHaveBeenCalled();
  });
});
