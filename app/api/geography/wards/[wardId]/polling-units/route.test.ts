import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  requireUser: vi.fn(),
  getClientIp: vi.fn(),
  listWardPollingUnits: vi.fn(),
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
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/geography/wards/7/polling-units?limit=25"),
      { params: Promise.resolve({ wardId: "7" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.listWardPollingUnits).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      7,
      { limit: 25 },
      { ipAddress: "203.0.113.1" },
    );
  }, 15_000);

  it("returns 404 when the requested ward is outside scope", async () => {
    mocks.listWardPollingUnits.mockResolvedValue(null);
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/geography/wards/8/polling-units"),
      { params: Promise.resolve({ wardId: "8" }) },
    );

    expect(response.status).toBe(404);
  });

  it("rejects a page size above 100 before querying", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/geography/wards/7/polling-units?limit=101"),
      { params: Promise.resolve({ wardId: "7" }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.listWardPollingUnits).not.toHaveBeenCalled();
  });
});
