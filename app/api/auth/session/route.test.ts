import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookie: "session-token" as string | undefined,
  getDataSource: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (mocks.cookie === undefined ? undefined : { value: mocks.cookie }),
  }),
}));
vi.mock("@/lib/db", () => ({ getDataSource: mocks.getDataSource }));

import { GET } from "./route";

const MINUTE = 60 * 1000;

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    person_id: "person-1",
    expires_at: new Date(Date.now() + 60 * MINUTE),
    last_active_at: new Date(Date.now() - 5 * MINUTE),
    revoked_at: null,
    full_name: "Ada Obi",
    email_address: "ada@example.test",
    person_found: true,
    is_admin: true,
    ...overrides,
  };
}

function useDatabase(rows: unknown[]) {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  mocks.getDataSource.mockResolvedValue({
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      statements.push({ sql, params });
      return sql.trimStart().startsWith("SELECT") ? rows : [];
    }),
  });
  return statements;
}

describe("GET /api/auth/session", () => {
  beforeEach(() => {
    mocks.cookie = "session-token";
    mocks.getDataSource.mockReset();
  });

  it("returns the person and admin flag from a single read", async () => {
    const statements = useDatabase([sessionRow()]);

    const response = await GET();
    const body = await response.json();

    expect(body.data).toEqual({
      authenticated: true,
      person: {
        id: "person-1",
        fullName: "Ada Obi",
        emailAddress: "ada@example.test",
        isAdmin: true,
        candidateId: null,
      },
    });
    const reads = statements.filter((s) => s.sql.trimStart().startsWith("SELECT"));
    expect(reads).toHaveLength(1);
    expect(reads[0].sql).toContain("LEFT JOIN person p");
    expect(reads[0].sql).toContain("g.group_type = 'admin'");
  });

  it("writes last activity only when it is more than a minute old", async () => {
    let statements = useDatabase([sessionRow({ last_active_at: new Date(Date.now() - 2 * MINUTE) })]);
    await GET();
    expect(statements.filter((s) => s.sql.includes("UPDATE auth_session"))).toHaveLength(1);

    statements = useDatabase([sessionRow({ last_active_at: new Date(Date.now() - 5 * 1000) })]);
    await GET();
    expect(statements.filter((s) => s.sql.includes("UPDATE auth_session"))).toHaveLength(0);
  });

  it("deletes an expired session", async () => {
    const statements = useDatabase([sessionRow({ expires_at: new Date(Date.now() - MINUTE) })]);
    const body = await (await GET()).json();
    expect(body.data).toEqual({ authenticated: false });
    expect(statements.filter((s) => s.sql.includes("DELETE FROM auth_session"))).toHaveLength(1);
  });

  it("is signed out when the person no longer exists or there is no session", async () => {
    useDatabase([sessionRow({ person_found: false, full_name: null, email_address: null })]);
    expect((await (await GET()).json()).data).toEqual({ authenticated: false });

    useDatabase([]);
    expect((await (await GET()).json()).data).toEqual({ authenticated: false });

    mocks.cookie = undefined;
    expect((await (await GET()).json()).data).toEqual({ authenticated: false });
  });
});
