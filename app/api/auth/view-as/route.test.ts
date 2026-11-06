import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireApiAuth: vi.fn(), query: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth/api", () => ({ requireApiAuth: mocks.requireApiAuth }));

import { DELETE, GET, PUT } from "./route";

const GOVERNOR_ROW = { seat_id: 6, office_name: "Governor", unit_id: 155, unit_name: "ANAMBRA", unit_type: "state" };

function signIn(own: { isAdmin: boolean; hasGlobalCoverageAccess: boolean; scopes: unknown[] }, viewAs: unknown = null) {
  mocks.requireApiAuth.mockResolvedValue({
    ok: true,
    context: {
      dataSource: { query: mocks.query },
      sessionId: "session-1",
      own,
      ownLabel: own.isAdmin ? "Collate Admins" : "Campaign HQ",
      viewAs,
    },
  });
}

function request(method: string, body?: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/auth/view-as", {
    method,
    headers: { origin, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const ADMIN = { isAdmin: true, hasGlobalCoverageAccess: true, scopes: [] };
const STATE_LEAD = {
  isAdmin: false,
  hasGlobalCoverageAccess: false,
  scopes: [{ stateId: 5, lgaId: null, wardId: null, politicalUnitId: null }],
};

describe("/api/auth/view-as", () => {
  beforeEach(() => {
    mocks.requireApiAuth.mockReset();
    mocks.query.mockReset();
    mocks.query.mockResolvedValue([]);
  });

  it("lists the views with the one that is on", async () => {
    signIn(ADMIN, { label: "Candidate · Governor, Anambra", seatId: 6 });
    mocks.query.mockResolvedValue([GOVERNOR_ROW]);
    const response = await GET();
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.current).toBe("seat:6");
    expect(data.self).toEqual({ value: "admin", label: "Admin" });
    expect(data.groups[1]).toEqual({
      heading: "Candidate · Governor",
      options: [{ value: "seat:6", label: "Anambra" }],
    });
  });

  it("stores a seat inside the person's access on the session", async () => {
    signIn(STATE_LEAD);
    mocks.query.mockImplementation(async (sql: string) => (sql.includes("UPDATE") ? [] : [GOVERNOR_ROW]));
    const response = await PUT(request("PUT", { value: "seat:6" }));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ viewAs: "Candidate · Governor, Anambra" });
    const update = mocks.query.mock.calls.find(([sql]) => String(sql).includes("UPDATE auth_session"));
    expect(update?.[1]).toEqual([
      JSON.stringify({ kind: "seat", seatId: 6, unitId: 155, unitType: "state", label: "Candidate · Governor, Anambra" }),
      "session-1",
    ]);
  });

  it("refuses a view above or outside the person's access", async () => {
    signIn(STATE_LEAD);
    for (const value of ["party", "admin", "seat:7"]) {
      const response = await PUT(request("PUT", { value }));
      expect(response.status).toBe(403);
    }
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("UPDATE"))).toBe(false);
  });

  it("goes back to the person's own access when they pick it", async () => {
    signIn(ADMIN);
    const response = await PUT(request("PUT", { value: "admin" }));
    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("SET view_as = $1::jsonb"), [null, "session-1"]);
  });

  it("rejects a bad body and a cross-origin request", async () => {
    signIn(ADMIN);
    expect((await PUT(request("PUT", { value: 3 }))).status).toBe(400);
    expect((await PUT(request("PUT", { value: "party" }, "https://evil.example"))).status).toBe(403);
    expect((await DELETE(request("DELETE", undefined, "https://evil.example"))).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("exits the view", async () => {
    signIn(ADMIN, { label: "Party · National", seatId: null });
    const response = await DELETE(request("DELETE"));
    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("SET view_as = NULL"), ["session-1"]);
  });
});
