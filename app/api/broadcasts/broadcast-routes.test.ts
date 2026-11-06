import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "@/lib/auth/errors";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  policyUserFromCurrentUser: vi.fn(),
  assertSameOrigin: vi.fn(),
  previewAudience: vi.fn(),
  createBroadcast: vi.fn(),
  listBroadcasts: vi.fn(),
  getBroadcastDetail: vi.fn(),
  listBroadcastDeliveries: vi.fn(),
}));

vi.mock("@/lib/auth/current-user", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/auth/request", () => ({
  assertSameOrigin: mocks.assertSameOrigin,
  getClientIp: () => "203.0.113.9",
}));

vi.mock("@/lib/policy", () => ({
  policyUserFromCurrentUser: mocks.policyUserFromCurrentUser,
}));

vi.mock("@/lib/policy/core/audience", () => ({
  previewAudience: mocks.previewAudience,
}));

vi.mock("@/lib/broadcast/service", () => ({
  createBroadcast: mocks.createBroadcast,
}));

vi.mock("@/lib/broadcast/queries", () => ({
  listBroadcasts: mocks.listBroadcasts,
  getBroadcastDetail: mocks.getBroadcastDetail,
  listBroadcastDeliveries: mocks.listBroadcastDeliveries,
}));

const user = {
  personId: "11111111-1111-4111-8111-111111111111",
  isAdmin: false,
  candidateId: null,
  seatId: null,
  groupIds: [],
  scopeUnits: { stateIds: [], lgaIds: [], wardIds: [], politicalUnitIds: [] },
};

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/broadcasts/preview", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

describe("broadcast routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ personId: user.personId });
    mocks.policyUserFromCurrentUser.mockResolvedValue(user);
    mocks.assertSameOrigin.mockImplementation(() => undefined);
    mocks.previewAudience.mockResolvedValue({ officialCount: 2, extraCount: 3 });
    mocks.listBroadcasts.mockResolvedValue({ items: [], nextCursor: null });
    mocks.getBroadcastDetail.mockResolvedValue(null);
    mocks.listBroadcastDeliveries.mockResolvedValue(null);
  });

  it("returns 401 without a session", async () => {
    mocks.requireUser.mockRejectedValue(new UnauthorizedError());
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/broadcasts?limit=10"),
    );
    expect(response.status).toBe(401);
  });

  it("returns 403 for a cross-origin POST", async () => {
    mocks.assertSameOrigin.mockImplementation(() => {
      throw new Error("Origin mismatch");
    });
    const { POST } = await import("./preview/route");
    const response = await POST(postRequest({}));
    expect(response.status).toBe(403);
    expect(mocks.requireUser).not.toHaveBeenCalled();
  });

  it("returns official and extra counts only from preview", async () => {
    const { POST } = await import("./preview/route");
    const response = await POST(postRequest({}));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "success",
      data: { officialCount: 2, extraCount: 3 },
    });
  });

  it("returns 404 for a broadcast the caller cannot see", async () => {
    const { GET } = await import("./[id]/route");
    const response = await GET(
      new Request("http://localhost/api/broadcasts/22222222-2222-4222-8222-222222222222"),
      { params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" }) },
    );
    expect(response.status).toBe(404);
  });

  it("rejects a malformed broadcast ID", async () => {
    const { GET } = await import("./[id]/route");
    const response = await GET(
      new Request("http://localhost/api/broadcasts/not-a-uuid"),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );
    expect(response.status).toBe(400);
    expect(mocks.getBroadcastDetail).not.toHaveBeenCalled();
  });

  it("rejects a malformed broadcast ID for deliveries", async () => {
    const { GET } = await import("./[id]/deliveries/route");
    const response = await GET(
      new Request("http://localhost/api/broadcasts/not-a-uuid/deliveries"),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );
    expect(response.status).toBe(400);
    expect(mocks.listBroadcastDeliveries).not.toHaveBeenCalled();
  });

  it("rejects a page size above 100", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/broadcasts?limit=101"),
    );
    expect(response.status).toBe(400);
    expect(mocks.listBroadcasts).not.toHaveBeenCalled();
  });

  it("passes the recipient filters to the deliveries query and returns the total", async () => {
    mocks.listBroadcastDeliveries.mockResolvedValue({ items: [], nextCursor: null, total: 42 });
    const { GET } = await import("./[id]/deliveries/route");
    const response = await GET(
      new Request(
        "http://localhost/api/broadcasts/22222222-2222-4222-8222-222222222222/deliveries" +
          "?limit=100&status=failed&group=extra_agent&search=%20Kano%20",
      ),
      { params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.listBroadcastDeliveries).toHaveBeenCalledWith(
      user,
      "22222222-2222-4222-8222-222222222222",
      expect.objectContaining({
        limit: 100,
        filters: { status: "failed", group: "extra_agent", search: "Kano" },
      }),
    );
    const body = await response.json();
    expect(body.meta).toEqual({ nextCursor: null, limit: 100, total: 42 });
  });

  it("rejects an unknown delivery status or group", async () => {
    const { GET } = await import("./[id]/deliveries/route");
    for (const query of ["status=lost", "group=everyone"]) {
      const response = await GET(
        new Request(
          `http://localhost/api/broadcasts/22222222-2222-4222-8222-222222222222/deliveries?${query}`,
        ),
        { params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" }) },
      );
      expect(response.status).toBe(400);
    }
    expect(mocks.listBroadcastDeliveries).not.toHaveBeenCalled();
  });

  it("does not expose a full phone number in the deliveries response", async () => {
    mocks.listBroadcastDeliveries.mockResolvedValue({
      items: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          personId: user.personId,
          fullName: "Demo Person",
          maskedPhone: "+234******5678",
          channel: "telegram",
          status: "delivered",
          sentAt: null,
          deliveredAt: null,
          tappedOkAt: null,
          failedAt: null,
          createdAt: new Date().toISOString(),
        },
      ],
      nextCursor: null,
    });

    const { GET } = await import("./[id]/deliveries/route");
    const response = await GET(
      new Request(
        "http://localhost/api/broadcasts/22222222-2222-4222-8222-222222222222/deliveries",
      ),
      { params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" }) },
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).not.toContain("+2348012345678");
    expect(body).toContain("+234******5678");
  });
});
