import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookie: "session-token" as string | undefined,
  getDataSource: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (mocks.cookie === undefined ? undefined : { value: mocks.cookie }),
  }),
}));
vi.mock("@/lib/db", () => ({ getDataSource: mocks.getDataSource }));

import { requireApiAuth } from "./api";

const MINUTE = 60 * 1000;

type Row = Record<string, unknown>;

function sessionRow(overrides: Row = {}): Row {
  return {
    id: "session-1",
    person_id: "person-1",
    expires_at: new Date(Date.now() + 24 * 60 * MINUTE),
    last_active_at: new Date(Date.now() - 5 * MINUTE),
    revoked_at: null,
    group_name: "NDC National",
    group_type: "party",
    scope_state_id: null,
    scope_lga_id: null,
    scope_ward_id: null,
    scope_political_unit_id: null,
    ...overrides,
  };
}

function useDatabase(rows: Row[]) {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  const dataSource = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      statements.push({ sql, params });
      return sql.includes("FROM auth_session") && sql.trimStart().startsWith("SELECT") ? rows : [];
    }),
  };
  mocks.getDataSource.mockResolvedValue(dataSource);
  return statements;
}

describe("requireApiAuth", () => {
  beforeEach(() => {
    mocks.cookie = "session-token";
    mocks.getDataSource.mockReset();
  });

  it("rejects a request without a session cookie without touching the database", async () => {
    mocks.cookie = undefined;
    const result = await requireApiAuth();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
    expect(mocks.getDataSource).not.toHaveBeenCalled();
  });

  it("reads the session, groups and scopes in one query", async () => {
    const statements = useDatabase([
      sessionRow({ group_name: "Campaign HQ", group_type: "campaign", scope_state_id: 5 }),
      sessionRow({ group_name: "Campaign HQ", group_type: "campaign", scope_lga_id: 300 }),
    ]);

    const result = await requireApiAuth();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const reads = statements.filter((s) => s.sql.trimStart().startsWith("SELECT"));
    expect(reads).toHaveLength(1);
    expect(reads[0].sql).toContain("FROM auth_session");
    expect(reads[0].sql).toContain("LEFT JOIN membership_scope_unit");
    expect(result.context.personId).toBe("person-1");
    expect(result.context.canManageCoverage).toBe(true);
    expect(result.context.hasGlobalCoverageAccess).toBe(false);
    expect(result.context.scopes).toEqual([
      { stateId: 5, lgaId: null, wardId: null, politicalUnitId: null },
      { stateId: null, lgaId: 300, wardId: null, politicalUnitId: null },
    ]);
  });

  it("writes last activity when it is more than a minute old", async () => {
    const statements = useDatabase([sessionRow({ last_active_at: new Date(Date.now() - 2 * MINUTE) })]);
    await requireApiAuth();
    const updates = statements.filter((s) => s.sql.includes("UPDATE auth_session"));
    expect(updates).toHaveLength(1);
    expect(updates[0].params).toEqual(["session-1"]);
  });

  it("skips the activity write when the session was used in the last minute", async () => {
    const statements = useDatabase([sessionRow({ last_active_at: new Date(Date.now() - 10 * 1000) })]);
    const result = await requireApiAuth();
    expect(result.ok).toBe(true);
    expect(statements.filter((s) => s.sql.includes("UPDATE auth_session"))).toHaveLength(0);
  });

  it("deletes an expired session and rejects the request", async () => {
    const statements = useDatabase([sessionRow({ expires_at: new Date(Date.now() - MINUTE) })]);
    const result = await requireApiAuth();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
    expect(statements.filter((s) => s.sql.includes("DELETE FROM auth_session"))).toHaveLength(1);
  });

  it("forbids a signed-in person with no group", async () => {
    const statements = useDatabase([sessionRow({ group_name: null, group_type: null })]);
    const result = await requireApiAuth();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
    expect(statements.filter((s) => s.sql.includes("UPDATE auth_session"))).toHaveLength(0);
  });
});
