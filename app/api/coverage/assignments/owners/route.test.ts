import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireApiAuth: vi.fn(), query: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth/api", () => ({ requireApiAuth: mocks.requireApiAuth }));

import { GET } from "./route";

const ME = "11111111-1111-4111-8111-111111111111";

function signIn(isAdmin = false) {
  mocks.requireApiAuth.mockResolvedValue({
    ok: true,
    context: { isAdmin, viewAs: null, personId: ME, dataSource: { query: mocks.query } },
  });
}

describe("GET /api/coverage/assignments/owners", () => {
  beforeEach(() => {
    mocks.requireApiAuth.mockReset();
    mocks.query.mockReset();
  });

  it("requires sign-in", async () => {
    mocks.requireApiAuth.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    expect((await GET()).status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("returns assignable groups by name and the caller's own candidate record", async () => {
    signIn(false);
    mocks.query
      .mockResolvedValueOnce([
        { id: "3", group_name: "NDC Lagos", type_name: "Party" },
        { id: 9, group_name: "NDC Lagos Youth", type_name: "Party" },
      ])
      .mockResolvedValueOnce([{ id: "7", full_name: "Ada Obi", office_name: "Governor" }]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      groups: [
        { id: 3, name: "NDC Lagos", type: "Party" },
        { id: 9, name: "NDC Lagos Youth", type: "Party" },
      ],
      candidates: [{ id: 7, name: "Ada Obi", office: "Governor" }],
    });

    const [groupSql, groupParameters] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(groupSql).toContain("WITH RECURSIVE group_tree");
    expect(groupParameters).toEqual([ME, false]);
    const [candidateSql, candidateParameters] = mocks.query.mock.calls[1] as [string, unknown[]];
    expect(candidateSql).toContain("c.person_id = $1");
    expect(candidateParameters).toEqual([ME]);
  });

  it("passes the admin flag so admins get every group", async () => {
    signIn(true);
    mocks.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await GET();
    expect((mocks.query.mock.calls[0] as [string, unknown[]])[1]).toEqual([ME, true]);
  });

  it("returns a generic 500 when the database fails", async () => {
    signIn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.query.mockRejectedValue(new Error("db down"));
    expect((await GET()).status).toBe(500);
    consoleError.mockRestore();
  });
});
