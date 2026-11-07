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

/** The built-in group types' rules, as in the group_type table. */
const TYPE_RULES: Record<string, { can_message: string; sees_coverage: string }> = {
  admin: { can_message: "all_agents", sees_coverage: "national" },
  party: { can_message: "agents_they_cover", sees_coverage: "national" },
  campaign: { can_message: "agents_they_cover", sees_coverage: "own_area" },
  support_group: { can_message: "none", sees_coverage: "own_area" },
};

function sessionRow(overrides: Row = {}): Row {
  const type = "group_type" in overrides ? (overrides.group_type as string | null) : "party";
  return {
    id: "session-1",
    person_id: "person-1",
    expires_at: new Date(Date.now() + 24 * 60 * MINUTE),
    last_active_at: new Date(Date.now() - 5 * MINUTE),
    revoked_at: null,
    group_name: "NDC National",
    group_type: "party",
    can_message: type ? TYPE_RULES[type]?.can_message ?? null : null,
    sees_coverage: type ? TYPE_RULES[type]?.sees_coverage ?? null : null,
    scope_state_id: null,
    scope_lga_id: null,
    scope_ward_id: null,
    scope_political_unit_id: null,
    ...overrides,
  };
}

function useDatabase(rows: Row[], candidateSeats: Row[] = []) {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  const dataSource = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      statements.push({ sql, params });
      if (sql.includes("FROM candidate c") && sql.includes("principal")) return candidateSeats;
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

  it("applies a stored View as: the previewed access, no admin rights, own access kept apart", async () => {
    useDatabase([
      sessionRow({
        group_name: "Collate Admins",
        group_type: "admin",
        view_as: { kind: "seat", seatId: 6, unitId: 155, unitType: "state", label: "Candidate · Governor, Anambra" },
      }),
    ]);
    const result = await requireApiAuth();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.isAdmin).toBe(false);
    expect(result.context.hasGlobalCoverageAccess).toBe(false);
    expect(result.context.scopes).toEqual([{ stateId: null, lgaId: null, wardId: null, politicalUnitId: 155 }]);
    expect(result.context.roles).toEqual([{ name: "Candidate · Governor, Anambra", type: "view_as" }]);
    expect(result.context.viewAs).toEqual({ label: "Candidate · Governor, Anambra", seatId: 6 });
    expect(result.context.own.isAdmin).toBe(true);
    expect(result.context.ownLabel).toBe("Collate Admins");
  });

  it("ends a stored view that the person's own access no longer covers", async () => {
    const statements = useDatabase([
      sessionRow({
        group_name: "Campaign HQ",
        group_type: "campaign",
        scope_state_id: 5,
        view_as: { kind: "seat", seatId: 7, unitId: 156, unitType: "state", label: "Candidate · Governor, Lagos" },
      }),
    ]);
    const result = await requireApiAuth();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.viewAs).toBeNull();
    expect(result.context.scopes).toEqual([{ stateId: 5, lgaId: null, wardId: null, politicalUnitId: null }]);
    expect(statements.some((s) => s.sql.includes("SET view_as = NULL"))).toBe(true);
  });

  it("takes national coverage and messaging from the group type, including a type an admin made", async () => {
    useDatabase([
      sessionRow({ group_name: "Youth Wing", group_type: "support_group", scope_state_id: 5 }),
      sessionRow({
        group_name: "National Observers",
        group_type: null,
        can_message: "none",
        sees_coverage: "national",
      }),
    ]);
    const result = await requireApiAuth();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.hasGlobalCoverageAccess).toBe(true);
    expect(result.context.canMessage).toBe(false);
    expect(result.context.canManageCoverage).toBe(true);
    expect(result.context.roles).toEqual([
      { name: "Youth Wing", type: "support_group" },
      { name: "National Observers", type: "custom" },
    ]);
  });

  it("lets a support group look at its own area but not message", async () => {
    useDatabase([sessionRow({ group_name: "Youth Wing", group_type: "support_group", scope_state_id: 5 })]);
    const result = await requireApiAuth();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.canManageCoverage).toBe(true);
    expect(result.context.canMessage).toBe(false);
    expect(result.context.hasGlobalCoverageAccess).toBe(false);
    expect(result.context.scopes).toEqual([{ stateId: 5, lgaId: null, wardId: null, politicalUnitId: null }]);
  });

  it("gives a candidate with no group their seat's area", async () => {
    const statements = useDatabase(
      [sessionRow({ group_name: null, group_type: null })],
      [{ seat_id: 40, office_name: "Senate", unit_id: 77, unit_name: "ANAMBRA SOUTH", unit_type: "senatorial_district", is_running_mate: false }],
    );
    const result = await requireApiAuth();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(statements.find((s) => s.sql.includes("FROM candidate c"))?.params).toEqual(["person-1"]);
    expect(result.context.isAdmin).toBe(false);
    expect(result.context.canMessage).toBe(true);
    expect(result.context.hasGlobalCoverageAccess).toBe(false);
    expect(result.context.scopes).toEqual([{ stateId: null, lgaId: null, wardId: null, politicalUnitId: 77 }]);
    expect(result.context.ownLabel).toBe("Candidate · Senate, Anambra South");
    expect(result.context.roles).toEqual([{ name: "Candidate · Senate, Anambra South", type: "candidate" }]);
  });

  it("gives a running mate their principal's seat: national for the Vice President", async () => {
    useDatabase(
      [sessionRow({ group_name: null, group_type: null })],
      [{ seat_id: 1, office_name: "President", unit_id: 1, unit_name: "NIGERIA", unit_type: "country", is_running_mate: true }],
    );
    const result = await requireApiAuth();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.hasGlobalCoverageAccess).toBe(true);
    expect(result.context.scopes).toEqual([]);
    expect(result.context.ownLabel).toBe("Candidate · Vice President");
  });

  it("forbids a signed-in person with no group", async () => {
    const statements = useDatabase([sessionRow({ group_name: null, group_type: null })]);
    const result = await requireApiAuth();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
    expect(statements.filter((s) => s.sql.includes("UPDATE auth_session"))).toHaveLength(0);
  });
});
