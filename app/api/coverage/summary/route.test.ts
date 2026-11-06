import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDataSource: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "session-token" }) }),
}));
vi.mock("@/lib/db", () => ({ getDataSource: mocks.getDataSource }));

import { GET } from "./route";

const AUTH_ROWS = [
  {
    id: "session-1",
    person_id: "person-1",
    expires_at: new Date(Date.now() + 60 * 60 * 1000),
    last_active_at: new Date(),
    revoked_at: null,
    group_name: "Collate Admins",
    group_type: "admin",
    scope_state_id: null,
    scope_lga_id: null,
    scope_ward_id: null,
    scope_political_unit_id: null,
  },
];

function request(query = "") {
  const url = new URL(`http://localhost/api/coverage/summary${query}`);
  return Object.assign(new Request(url), { nextUrl: url }) as unknown as Parameters<typeof GET>[0];
}

describe("GET /api/coverage/summary", () => {
  let calls: Array<{ sql: string; params: unknown[] }>;

  beforeEach(() => {
    calls = [];
    mocks.getDataSource.mockReset();
    mocks.getDataSource.mockResolvedValue({
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes("FROM auth_session")) return AUTH_ROWS;
        calls.push({ sql, params });
        return [{ total_pus: "200", covered_pus: "50", gps_pus: "150", extra_agents: "7" }];
      }),
    });
  });

  it("returns the same figures as before", async () => {
    const body = await (await GET(request("?stateId=5"))).json();
    expect(body.data).toEqual({
      totalPUs: 200,
      coveredPUs: 50,
      noCoveragePUs: 150,
      gpsPUs: 150,
      extraAgentsCount: 7,
      officialAgentPct: 25,
    });
  });

  it("joins only the official agent, so no polling unit is counted twice", async () => {
    await GET(request());
    const { sql } = calls[0];
    expect(sql).not.toContain("COUNT(DISTINCT");
    expect(sql).toContain(
      "LEFT JOIN agent_assignment aa ON aa.polling_unit_id = pu.id AND aa.agent_kind = 'official'",
    );
    expect(sql).toContain("COUNT(aa.polling_unit_id) AS covered_pus");
  });

  it("counts extra agents over the same filtered polling units", async () => {
    await GET(request("?stateId=5&gps=with"));
    const { sql, params } = calls[0];
    expect(sql).toContain("xa.agent_kind = 'extra'");
    // The state filter ($6) and the GPS filter appear in the main query and in the extra count.
    expect(sql.match(/s\.id = \$6/g)?.length).toBe(2);
    expect(sql.match(/pu\.latitude IS NOT NULL/g)?.length).toBe(3);
    expect(params).toEqual([true, [], [], [], [], 5]);
  });
});
