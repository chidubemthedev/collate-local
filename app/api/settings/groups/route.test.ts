import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireApiAuth: vi.fn(), query: vi.fn(), managerQuery: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth/api", () => ({
  requireApiAuth: mocks.requireApiAuth,
  readOnlyResponse: () => new Response(null, { status: 403 }),
}));

import { GET, POST } from "./route";

const ORIGIN = "http://localhost:3000";

const TYPE_ROWS = [
  { id: 1, type_key: "admin", type_name: "Admin", can_message: "all_agents", sees_coverage: "national", can_own_agents: false, is_system: true },
  { id: 2, type_key: "party", type_name: "Party", can_message: "agents_they_cover", sees_coverage: "national", can_own_agents: true, is_system: true },
  { id: 9, type_key: null, type_name: "Women Wing", can_message: "none", sees_coverage: "own_area", can_own_agents: true, is_system: false },
];

function signIn(isAdmin: boolean, viewAs: { label: string; seatId: number | null } | null = null) {
  mocks.requireApiAuth.mockResolvedValue({
    ok: true,
    context: {
      isAdmin,
      viewAs,
      personId: "person-1",
      dataSource: {
        query: mocks.query,
        transaction: (work: (manager: { query: typeof mocks.managerQuery }) => unknown) =>
          work({ query: mocks.managerQuery }),
      },
    },
  });
}

function post(body: unknown, origin: string | null = ORIGIN) {
  return POST(
    new Request(`${ORIGIN}/api/settings/groups`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("GET /api/settings/groups", () => {
  beforeEach(() => {
    mocks.requireApiAuth.mockReset();
    mocks.query.mockReset();
  });

  it("returns every group type from the group_type table", async () => {
    signIn(true);
    mocks.query.mockResolvedValue(TYPE_ROWS);
    const response = await GET();
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(String(mocks.query.mock.calls[0][0])).toContain("FROM group_type");
    expect(data).toHaveLength(3);
    expect(data[0]).toEqual({
      id: 1,
      key: "admin",
      name: "Admin",
      canMessage: "all_agents",
      seesCoverage: "national",
      canOwnAgents: false,
      isSystem: true,
    });
    expect(data[2]).toMatchObject({ key: null, name: "Women Wing", canMessage: "none", isSystem: false });
  });

  it("refuses anyone who is not an admin, including an admin previewing another access", async () => {
    signIn(false);
    const response = await GET();
    expect(response.status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("passes on the sign-in failure", async () => {
    mocks.requireApiAuth.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    expect((await GET()).status).toBe(401);
  });
});

describe("POST /api/settings/groups", () => {
  beforeEach(() => {
    mocks.requireApiAuth.mockReset();
    mocks.managerQuery.mockReset();
  });

  it("creates a group type that can own agents, and writes the audit log", async () => {
    signIn(true);
    mocks.managerQuery
      .mockResolvedValueOnce([TYPE_ROWS[2]])
      .mockResolvedValueOnce([]);
    const response = await post({ name: "  Women   Wing ", canMessage: "none", seesCoverage: "own_area" });
    expect(response.status).toBe(201);
    const { data } = await response.json();
    expect(data).toMatchObject({ id: 9, key: null, name: "Women Wing", canOwnAgents: true, isSystem: false });

    const [insertSql, insertParams] = mocks.managerQuery.mock.calls[0];
    expect(String(insertSql)).toContain("INSERT INTO group_type");
    expect(insertParams).toEqual(["Women Wing", "none", "own_area"]);
    const [auditSql, auditParams] = mocks.managerQuery.mock.calls[1];
    expect(String(auditSql)).toContain("INSERT INTO audit_log");
    expect(String(auditSql)).toContain("settings.group_type.created");
    expect(auditParams).toEqual(["person-1", "9", "unknown"]);
  });

  it("returns 409 when the name is taken (any letter case)", async () => {
    signIn(true);
    mocks.managerQuery.mockResolvedValueOnce([]);
    const response = await post({ name: "party", canMessage: "agents_they_cover", seesCoverage: "national" });
    expect(response.status).toBe(409);
    expect(mocks.managerQuery).toHaveBeenCalledTimes(1);
  });

  it("rejects a missing name and values a new type may not take", async () => {
    signIn(true);
    const response = await post({ name: " ", canMessage: "all_agents", seesCoverage: "state" });
    expect(response.status).toBe(400);
    const { error } = await response.json();
    expect(Object.keys(error.fields).sort()).toEqual(["canMessage", "name", "seesCoverage"]);
    expect(mocks.managerQuery).not.toHaveBeenCalled();
  });

  it("rejects a name longer than 80 characters and invalid JSON", async () => {
    signIn(true);
    expect((await post({ name: "x".repeat(81), canMessage: "none", seesCoverage: "national" })).status).toBe(400);
    expect((await post("{not json")).status).toBe(400);
    expect(mocks.managerQuery).not.toHaveBeenCalled();
  });

  it("refuses non-admins and admins using View as", async () => {
    signIn(false);
    expect((await post({ name: "A", canMessage: "none", seesCoverage: "national" })).status).toBe(403);
    signIn(true, { label: "Party", seatId: null });
    expect((await post({ name: "A", canMessage: "none", seesCoverage: "national" })).status).toBe(403);
    expect(mocks.managerQuery).not.toHaveBeenCalled();
  });

  it("refuses a request from another origin", async () => {
    signIn(true);
    expect((await post({ name: "A", canMessage: "none", seesCoverage: "national" }, "https://evil.example")).status).toBe(403);
    expect((await post({ name: "A", canMessage: "none", seesCoverage: "national" }, null)).status).toBe(403);
    expect(mocks.requireApiAuth).not.toHaveBeenCalled();
  });
});
