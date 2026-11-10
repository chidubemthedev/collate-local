import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireApiAuth: vi.fn(), query: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth/api", () => ({
  requireApiAuth: mocks.requireApiAuth,
  // Scope to one state, so the scope uses parameter $1.
  getCoverageScopeFilter: () => ({ sql: "s.id = $1", parameters: [25] }),
}));

import { encodeGapsCursor } from "@/lib/coverage/gaps-cursor";
import { GET } from "./route";

function gap(id: number, code: string) {
  return {
    id,
    code,
    name: `PU ${id}`,
    latitude: null,
    longitude: null,
    has_gps: false,
    ward_code: "09",
    ward_name: "ARIARIA MARKET",
    lga_code: "01",
    lga_name: "ABA NORTH",
    state_code: "01",
    state_name: "ABIA",
  };
}

function get(query = "") {
  const url = new URL(`http://localhost:3000/api/coverage/gaps${query}`);
  return GET(Object.assign(new Request(url), { nextUrl: url }) as unknown as Parameters<typeof GET>[0]);
}

describe("GET /api/coverage/gaps", () => {
  beforeEach(() => {
    mocks.requireApiAuth.mockReset();
    mocks.query.mockReset();
    mocks.requireApiAuth.mockResolvedValue({ ok: true, context: { dataSource: { query: mocks.query } } });
  });

  it("returns the first page with the total and a cursor for the next page", async () => {
    mocks.query.mockResolvedValueOnce([gap(335, "01/01/09/005"), gap(336, "01/01/09/006"), gap(337, "01/01/09/007")]);
    mocks.query.mockResolvedValueOnce([{ total: 40 }]);

    const response = await get("?limit=2");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.totalCount).toBe(40);
    expect(body.data.limit).toBe(2);
    expect(body.data.items.map((item: { id: number }) => item.id)).toEqual([335, 336]);
    expect(body.data.items[0]).toMatchObject({ code: "01/01/09/005", ward: { name: "ARIARIA MARKET" }, state: { code: "01" } });
    expect(body.meta.nextCursor).toBe(
      encodeGapsCursor({ stateName: "ABIA", lgaName: "ABA NORTH", wardName: "ARIARIA MARKET", code: "01/01/09/006", id: 336 }),
    );

    const [pageSql, pageParams] = mocks.query.mock.calls[0];
    expect(String(pageSql)).toContain("ORDER BY s.state_name, l.lga_name, w.ward_name, pu.inec_polling_unit_code, pu.id");
    expect(String(pageSql)).not.toContain("OFFSET");
    expect(pageParams).toEqual([25, 3]);
    const [countSql, countParams] = mocks.query.mock.calls[1];
    expect(String(countSql)).toContain("COUNT(*)");
    expect(countParams).toEqual([25]);
  });

  it("continues after the cursor, without counting again", async () => {
    mocks.query.mockResolvedValueOnce([gap(337, "01/01/09/007")]);
    const cursor = encodeGapsCursor({ stateName: "ABIA", lgaName: "ABA NORTH", wardName: "ARIARIA MARKET", code: "01/01/09/006", id: 336 });

    const response = await get(`?limit=2&cursor=${cursor}`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.totalCount).toBeNull();
    expect(body.meta.nextCursor).toBeNull();
    expect(mocks.query).toHaveBeenCalledTimes(1);

    const [sql, params] = mocks.query.mock.calls[0];
    expect(String(sql)).toContain(
      "(s.state_name, l.lga_name, w.ward_name, pu.inec_polling_unit_code, pu.id) > ($2::text, $3::text, $4::text, $5::text, $6::int)",
    );
    expect(String(sql)).toContain("LIMIT $7");
    expect(params).toEqual([25, "ABIA", "ABA NORTH", "ARIARIA MARKET", "01/01/09/006", 336, 3]);
  });

  it("keeps geography filters before the cursor parameters", async () => {
    mocks.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);
    const response = await get("?wardId=9");
    expect(response.status).toBe(200);
    expect(mocks.query.mock.calls[0][1]).toEqual([25, 9, 101]);
    expect(mocks.query.mock.calls[1][1]).toEqual([25, 9]);
  });

  it("searches the PU code or name, matching % and _ literally", async () => {
    mocks.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);
    const response = await get("?wardId=9&q=%20%2001%2F01_%25%20");
    expect(response.status).toBe(200);

    const [pageSql, pageParams] = mocks.query.mock.calls[0];
    expect(String(pageSql)).toContain("(pu.inec_polling_unit_code ILIKE $3 OR pu.polling_unit_name ILIKE $3)");
    expect(pageParams).toEqual([25, 9, "%01/01\\_\\%%", 101]);
    const [countSql, countParams] = mocks.query.mock.calls[1];
    expect(String(countSql)).toContain("pu.inec_polling_unit_code ILIKE $3");
    expect(countParams).toEqual([25, 9, "%01/01\\_\\%%"]);
  });

  it("puts the search before the cursor parameters", async () => {
    mocks.query.mockResolvedValueOnce([]);
    const cursor = encodeGapsCursor({ stateName: "ABIA", lgaName: "ABA NORTH", wardName: "ARIARIA MARKET", code: "01/01/09/006", id: 336 });
    await get(`?q=town&cursor=${cursor}`);
    const [sql, params] = mocks.query.mock.calls[0];
    expect(String(sql)).toContain("ILIKE $2");
    expect(String(sql)).toContain("($3::text, $4::text, $5::text, $6::text, $7::int)");
    expect(params).toEqual([25, "%town%", "ABIA", "ABA NORTH", "ARIARIA MARKET", "01/01/09/006", 336, 101]);
  });

  it("rejects a search over 100 characters", async () => {
    expect((await get(`?q=${"a".repeat(101)}`)).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("rejects a bad limit or cursor", async () => {
    expect((await get("?limit=0")).status).toBe(400);
    expect((await get("?limit=501")).status).toBe(400);
    expect((await get("?cursor=nope!")).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("passes on the sign-in failure", async () => {
    mocks.requireApiAuth.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    expect((await get()).status).toBe(401);
  });
});
