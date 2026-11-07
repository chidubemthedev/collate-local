import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDataSource: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "session-token" }) }),
}));
vi.mock("@/lib/db", () => ({ getDataSource: mocks.getDataSource }));

import { GET as getStates } from "./states/route";
import { GET as getState } from "./states/[stateId]/route";
import { GET as getLgas } from "./states/[stateId]/lgas/route";
import { GET as getWards } from "./lgas/[lgaId]/wards/route";

const AUTH_ROWS = [
  {
    id: "session-1",
    person_id: "person-1",
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

/** Answers the auth lookup, then returns `rows` for the route's own query. */
function useDatabase(rows: unknown[]) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  mocks.getDataSource.mockResolvedValue({
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("FROM auth_session")) return AUTH_ROWS;
      calls.push({ sql, params });
      return rows;
    }),
  });
  return calls;
}

const counts = { total_pus: "40", covered_pus: "10", gps_pus: "30", extra_agents: "3" };

function expectCountingWithoutDuplicates(sql: string) {
  // Polling units are counted once each, without DISTINCT over every polling unit.
  expect(sql).not.toContain("COUNT(DISTINCT pu.id)");
  expect(sql).toContain("COUNT(aa.polling_unit_id) AS covered_pus");
  expect(sql).toContain("aa.agent_kind = 'official'");
  // Extra agents come from their own assignments, not from the official-agent join.
  expect(sql).toContain("COUNT(DISTINCT xa.person_id) AS extra_agents");
  expect(sql).toContain("xa.agent_kind = 'extra'");
}

describe("geography coverage lists", () => {
  beforeEach(() => mocks.getDataSource.mockReset());

  it("states: counts per ward, rolls up, and reports extra agents", async () => {
    const calls = useDatabase([
      { id: 5, code: "05", name: "BAUCHI", ...counts, lgas_count: "20", wards_count: "212" },
    ]);

    const response = await getStates(new Request("http://localhost/api/geography/states?gps=with"));
    const body = await response.json();

    expect(body.data).toEqual([
      {
        id: 5,
        code: "05",
        name: "BAUCHI",
        totalPUs: 40,
        gpsPUs: 30,
        coveredPUs: 10,
        noCoveragePUs: 30,
        officialAgentPct: 25,
        extraAgentsCount: 3,
        lgasCount: 20,
        wardsCount: 212,
      },
    ]);
    const { sql, params } = calls[0];
    expectCountingWithoutDuplicates(sql);
    expect(sql).toContain("WITH ward_rows AS");
    expect(sql).toContain("GROUP BY s.id, l.id, w.id");
    // Scope and filters apply to the extra-agent count too.
    expect(sql.match(/s\.id = ANY\(\$2::int\[\]\)/g)?.length).toBe(2);
    expect(sql.match(/pu\.latitude IS NOT NULL/g)?.length).toBe(3);
    expect(params).toEqual([false, [5], [], [], []]);
  });

  it("state detail: same rules for one state", async () => {
    const calls = useDatabase([
      { id: 5, code: "05", name: "BAUCHI", ...counts, lgas_count: "20", wards_count: "212" },
    ]);

    const response = await getState(new Request("http://localhost/api/geography/states/5"), {
      params: Promise.resolve({ stateId: "5" }),
    });
    const body = await response.json();

    expect(body.data).toMatchObject({ id: 5, totalPUs: 40, coveredPUs: 10, extraAgentsCount: 3, wardsCount: 212 });
    expectCountingWithoutDuplicates(calls[0].sql);
    expect(calls[0].params).toEqual([false, [5], [], [], [], 5]);
  });

  it("state detail: still 404s when the state is not in scope", async () => {
    useDatabase([]);
    const response = await getState(new Request("http://localhost/api/geography/states/9"), {
      params: Promise.resolve({ stateId: "9" }),
    });
    expect(response.status).toBe(404);
  });

  it("LGAs: counts per ward within the state", async () => {
    const calls = useDatabase([
      {
        id: 91,
        state_id: 5,
        inec_state_code: "05",
        code: "01",
        name: "ALKALERI",
        ...counts,
        wards_count: "11",
      },
    ]);

    const response = await getLgas(new Request("http://localhost/api/geography/states/5/lgas"), {
      params: Promise.resolve({ stateId: "5" }),
    });
    const body = await response.json();

    expect(body.data[0]).toMatchObject({ id: 91, totalPUs: 40, coveredPUs: 10, extraAgentsCount: 3, wardsCount: 11 });
    expectCountingWithoutDuplicates(calls[0].sql);
    expect(calls[0].sql.match(/l\.state_id = \$6/g)?.length).toBe(2);
    expect(calls[0].params).toEqual([false, [5], [], [], [], 5]);
  });

  it("wards: counts each ward's polling units once", async () => {
    const calls = useDatabase([{ id: 3523, code: "01", name: "AKABO", ...counts }]);

    const response = await getWards(
      new Request("http://localhost/api/geography/lgas/300/wards?coverage=gaps"),
      { params: Promise.resolve({ lgaId: "300" }) },
    );
    const body = await response.json();

    expect(body.data[0]).toMatchObject({ id: 3523, totalPUs: 40, coveredPUs: 10, extraAgentsCount: 3 });
    expectCountingWithoutDuplicates(calls[0].sql);
    expect(calls[0].sql.match(/w\.lga_id = \$6/g)?.length).toBe(2);
    expect(calls[0].sql).toContain("gap_aa.agent_kind = 'official'");
    expect(calls[0].params).toEqual([false, [5], [], [], [], 300]);
  });
});
