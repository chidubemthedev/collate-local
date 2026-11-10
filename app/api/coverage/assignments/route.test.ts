import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDataSource: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "session-token" }) }),
}));
vi.mock("@/lib/db", () => ({ getDataSource: mocks.getDataSource }));
vi.mock("@/lib/auth/request", () => ({ getClientIp: () => "203.0.113.9" }));

import { POST } from "./route";

const PERSON_ID = "11111111-1111-4111-8111-111111111111";
const AUTH_ROWS = [
  {
    id: "session-1",
    person_id: "22222222-2222-4222-8222-222222222222",
    expires_at: new Date(Date.now() + 60 * 60 * 1000),
    last_active_at: new Date(),
    revoked_at: null,
    group_name: "Campaign HQ",
    group_type: "campaign",
    can_message: "agents_they_cover",
    sees_coverage: "own_area",
    scope_state_id: 5,
    scope_lga_id: null,
    scope_ward_id: null,
    scope_political_unit_id: null,
  },
];

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/coverage/assignments", {
      method: "POST",
      headers: { origin: "http://localhost", "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const validBody = {
  personId: PERSON_ID,
  pollingUnitId: 42,
  ownerGroupId: 3,
  ownerCandidateId: null,
  agentKind: "extra",
  slotNumber: 1,
};

/** `pollingUnit` is what the lock-and-scope query returns for polling unit 42. */
function useDatabase(pollingUnit: Array<{ id: number; allowed: boolean }>) {
  const calls: string[] = [];
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("FROM auth_session")) return AUTH_ROWS;
    calls.push(sql);
    if (sql.includes("FROM polling_unit pu")) return pollingUnit;
    if (sql.includes("FROM groups owner_group")) return [{ id: 3 }];
    if (sql.includes("AS next_slot")) return [{ next_slot: 3 }];
    if (sql.includes("AS exists")) return [{ exists: false }];
    if (sql.includes("INSERT INTO agent_assignment")) return [{ id: "new-assignment" }];
    return [];
  });
  const dataSource = { query, transaction: async (fn: (manager: unknown) => unknown) => fn({ query }) };
  mocks.getDataSource.mockResolvedValue(dataSource);
  return calls;
}

describe("POST /api/coverage/assignments", () => {
  beforeEach(() => mocks.getDataSource.mockReset());

  it("locks the polling unit and checks scope in one query", async () => {
    const calls = useDatabase([{ id: 42, allowed: true }]);

    const response = await post(validBody);

    expect(response.status).toBe(201);
    const lockQueries = calls.filter((sql) => sql.includes("FROM polling_unit pu"));
    expect(lockQueries).toHaveLength(1);
    expect(lockQueries[0]).toContain("FOR UPDATE OF pu");
    expect(lockQueries[0]).toContain("AS allowed");
    expect(calls.some((sql) => sql.includes("INSERT INTO audit_log"))).toBe(true);
  });

  it("returns not found when the polling unit is outside the caller's scope", async () => {
    const calls = useDatabase([{ id: 42, allowed: false }]);
    const response = await post(validBody);
    expect(response.status).toBe(404);
    expect(calls.some((sql) => sql.includes("INSERT INTO agent_assignment"))).toBe(false);
  });

  it("refuses every change while View as is on", async () => {
    const calls = useDatabase([{ id: 42, allowed: true }]);
    const original = { ...AUTH_ROWS[0] };
    Object.assign(AUTH_ROWS[0], {
      group_type: "party",
      sees_coverage: "national",
      scope_state_id: null,
      view_as: { kind: "party" },
    });
    try {
      const response = await post(validBody);
      expect(response.status).toBe(403);
      expect(calls).toHaveLength(0);
    } finally {
      Object.assign(AUTH_ROWS[0], original, { view_as: undefined });
    }
  });

  it("lets the caller assign for groups below their own, using the shared owner rule", async () => {
    const calls = useDatabase([{ id: 42, allowed: true }]);

    expect((await post(validBody)).status).toBe(201);

    const ownerQuery = calls.find((sql) => sql.includes("FROM groups owner_group"));
    expect(ownerQuery).toContain("WITH RECURSIVE group_tree");
    expect(ownerQuery).toContain("own_membership.person_id = $1");
    expect(ownerQuery).toContain("$3::boolean");
    expect(ownerQuery).toContain("FOR KEY SHARE OF owner_group");
  });

  it("picks the owner's next free slot when an extra agent is sent without one", async () => {
    const calls = useDatabase([{ id: 42, allowed: true }]);
    const { slotNumber: _omitted, ...withoutSlot } = validBody;
    void _omitted;

    expect((await post(withoutSlot)).status).toBe(201);

    const nextSlot = calls.find((sql) => sql.includes("AS next_slot"));
    expect(nextSlot).toContain("agent_kind = 'extra'");
    expect(nextSlot).toContain("owner_group_id IS NOT DISTINCT FROM $2");
    const { query } = await mocks.getDataSource.mock.results[0].value;
    const insert = query.mock.calls.find(([sql]: [string]) => sql.includes("INSERT INTO agent_assignment"));
    expect(insert[1][5]).toBe(3);
  });

  it("keeps a slot that is sent, without looking one up", async () => {
    const calls = useDatabase([{ id: 42, allowed: true }]);
    expect((await post(validBody)).status).toBe(201);
    expect(calls.some((sql) => sql.includes("AS next_slot"))).toBe(false);
  });

  it("still requires slot 0 for an official agent and rejects bad slots", async () => {
    useDatabase([{ id: 42, allowed: true }]);
    const { slotNumber: _omitted, ...withoutSlot } = validBody;
    void _omitted;
    expect((await post({ ...withoutSlot, agentKind: "official" })).status).toBe(400);
    expect((await post({ ...validBody, slotNumber: 0 })).status).toBe(400);
    expect((await post({ ...validBody, slotNumber: "2" })).status).toBe(400);
    expect((await post({ ...validBody, slotNumber: null })).status).toBe(400);
  });

  it("returns not found when the polling unit does not exist", async () => {
    useDatabase([]);
    const response = await post(validBody);
    expect(response.status).toBe(404);
  });
});
