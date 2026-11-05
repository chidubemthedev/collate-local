import { beforeEach, describe, expect, it, vi } from "vitest";
import { failure } from "@/lib/api/response";

// The first test also pays for loading the route module (several seconds on a cold run).
vi.setConfig({ testTimeout: 20_000 });

const SCOPE_SQL = "(scope_sql)";
const SCOPE_PARAMETERS = [true, [], [], [], []];

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  requireApiAuth: vi.fn(),
  getCoverageScopeFilter: vi.fn(),
  listCandidateCoverage: vi.fn(),
  countCandidates: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/server", () => ({
  connection: mocks.connection,
}));

vi.mock("@/lib/auth/api", () => ({
  requireApiAuth: mocks.requireApiAuth,
  getCoverageScopeFilter: mocks.getCoverageScopeFilter,
}));

vi.mock("@/lib/auth/request", () => ({
  getClientIp: () => "203.0.113.7",
}));

vi.mock("@/lib/coverage/candidate-coverage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/coverage/candidate-coverage")>(
    "@/lib/coverage/candidate-coverage",
  );
  return {
    ...actual,
    listCandidateCoverage: mocks.listCandidateCoverage,
    countCandidates: mocks.countCandidates,
  };
});

const dataSource = { query: vi.fn() };

function request(query: string): Request {
  return new Request(`http://localhost/api/coverage/candidates${query}`) as unknown as Request;
}

async function callGet(query: string): Promise<Response> {
  const { GET } = await import("./route");
  // The route only reads nextUrl.searchParams from the NextRequest.
  const req = request(query) as Request & { nextUrl: URL };
  Object.defineProperty(req, "nextUrl", { value: new URL(req.url) });
  return GET(req as never);
}

describe("GET /api/coverage/candidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connection.mockResolvedValue(undefined);
    mocks.requireApiAuth.mockResolvedValue({
      ok: true,
      context: { dataSource, personId: "11111111-1111-4111-8111-111111111111" },
    });
    mocks.getCoverageScopeFilter.mockReturnValue({ sql: SCOPE_SQL, parameters: SCOPE_PARAMETERS });
    mocks.listCandidateCoverage.mockResolvedValue({
      items: [],
      nextCursor: null,
      total: 0,
      offices: [],
    });
    mocks.countCandidates.mockResolvedValue(42);
  });

  it("passes nationalOnly and no overlap by default", async () => {
    const response = await callGet("?limit=12&nationalOnly=true");

    expect(response.status).toBe(200);
    expect(mocks.listCandidateCoverage).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 12,
        nationalOnly: true,
        overlap: { stateId: null, lgaId: null, wardId: null },
      }),
    );
    expect(mocks.countCandidates).not.toHaveBeenCalled();
  });

  it("defaults nationalOnly to false", async () => {
    await callGet("?limit=12");
    expect(mocks.listCandidateCoverage).toHaveBeenCalledWith(
      expect.objectContaining({ nationalOnly: false }),
    );
  });

  it("passes the seat-overlap area without clipping the geo filter", async () => {
    await callGet("?overlapStateId=4&overlapLgaId=17&overlapWardId=301");

    const call = mocks.listCandidateCoverage.mock.calls[0][0];
    expect(call.overlap).toEqual({ stateId: 4, lgaId: 17, wardId: 301 });
    // Overlap must not be folded into the geo filter (that would clip coverage totals).
    expect(call.geoSql).toBe(SCOPE_SQL);
    expect(call.geoParameters).toEqual(SCOPE_PARAMETERS);
  });

  it.each([
    ["nationalOnly=yes", "nationalOnly"],
    ["overlapStateId=0", "overlapStateId"],
    ["overlapLgaId=-3", "overlapLgaId"],
    ["overlapWardId=abc", "overlapWardId"],
    ["overlapWardId=1.5", "overlapWardId"],
    ["countOnly=1", "countOnly"],
  ])("rejects %s", async (query, field) => {
    const response = await callGet(`?${query}`);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.fields).toEqual({ [field]: "invalid_value" });
    expect(mocks.listCandidateCoverage).not.toHaveBeenCalled();
    expect(mocks.countCandidates).not.toHaveBeenCalled();
  });

  it("countOnly=true returns only the total and skips the coverage query", async () => {
    const response = await callGet("?countOnly=true&overlapStateId=4&officeId=3");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "success",
      data: [],
      meta: { total: 42 },
    });
    expect(mocks.listCandidateCoverage).not.toHaveBeenCalled();
    expect(mocks.countCandidates).toHaveBeenCalledWith({
      dataSource,
      geoSql: SCOPE_SQL,
      geoParameters: SCOPE_PARAMETERS,
      firstFreeParameter: SCOPE_PARAMETERS.length + 1,
      officeId: 3,
      nationalOnly: false,
      overlap: { stateId: 4, lgaId: null, wardId: null },
    });
  });

  it("countOnly=false falls through to the list", async () => {
    await callGet("?countOnly=false");
    expect(mocks.listCandidateCoverage).toHaveBeenCalled();
    expect(mocks.countCandidates).not.toHaveBeenCalled();
  });

  it("returns the auth response when unauthenticated", async () => {
    mocks.requireApiAuth.mockResolvedValue({
      ok: false,
      response: failure("unauthorized", "Authentication is required"),
    });
    const response = await callGet("?countOnly=true");
    expect(response.status).toBe(401);
    expect(mocks.countCandidates).not.toHaveBeenCalled();
  });
});
