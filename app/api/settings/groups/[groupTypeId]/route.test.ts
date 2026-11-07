import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireApiAuth: vi.fn(), query: vi.fn(), managerQuery: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth/api", () => ({
  requireApiAuth: mocks.requireApiAuth,
  readOnlyResponse: () => new Response(null, { status: 403 }),
}));

import { DELETE, GET } from "./route";

const ORIGIN = "http://localhost:3000";
const ADMIN = "11111111-1111-4111-8111-111111111111";

function signIn(isAdmin: boolean, viewAs: { label: string; seatId: number | null } | null = null) {
  mocks.requireApiAuth.mockResolvedValue({
    ok: true,
    context: {
      isAdmin,
      viewAs,
      personId: ADMIN,
      dataSource: {
        query: mocks.query,
        transaction: (work: (manager: { query: typeof mocks.managerQuery }) => unknown) =>
          work({ query: mocks.managerQuery }),
      },
    },
  });
}

const params = (id: string) => ({ params: Promise.resolve({ groupTypeId: id }) });
const get = (id = "9") => GET(new Request(`${ORIGIN}/api/settings/groups/${id}`), params(id));
const remove = (id = "9", origin: string | null = ORIGIN) =>
  DELETE(
    new Request(`${ORIGIN}/api/settings/groups/${id}`, { method: "DELETE", headers: origin ? { origin } : {} }),
    params(id),
  );

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
});

describe("GET /api/settings/groups/{id}", () => {
  it("lists the groups that use the type, with their members and agents", async () => {
    signIn(true);
    mocks.query
      .mockResolvedValueOnce([{ id: 9, type_name: "Women Wing", is_system: false }])
      .mockResolvedValueOnce([{ id: 4, group_name: "NDC Women Lagos", members: 3, agents: 120 }]);
    const response = await get();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      id: 9,
      name: "Women Wing",
      isSystem: false,
      canDelete: false,
      groups: [{ id: 4, name: "NDC Women Lagos", members: 3, agents: 120 }],
    });
    expect(mocks.query.mock.calls[1][1]).toEqual([9]);
  });

  it("says a type nothing uses can be deleted, and a built-in one never can", async () => {
    signIn(true);
    mocks.query.mockResolvedValueOnce([{ id: 9, type_name: "Women Wing", is_system: false }]).mockResolvedValueOnce([]);
    expect((await (await get()).json()).data).toMatchObject({ canDelete: true, groups: [] });
    mocks.query.mockResolvedValueOnce([{ id: 1, type_name: "Admin", is_system: true }]).mockResolvedValueOnce([]);
    expect((await (await get("1")).json()).data).toMatchObject({ isSystem: true, canDelete: false });
  });

  it("returns 404, 400 and 403 as expected", async () => {
    signIn(true);
    mocks.query.mockResolvedValueOnce([]);
    expect((await get()).status).toBe(404);
    expect((await get("abc")).status).toBe(400);
    signIn(false);
    expect((await get()).status).toBe(403);
  });
});

describe("DELETE /api/settings/groups/{id}", () => {
  it("deletes an unused type and writes the audit log", async () => {
    signIn(true);
    mocks.managerQuery
      .mockResolvedValueOnce([{ id: 9, type_name: "Women Wing", is_system: false }])
      .mockResolvedValueOnce([{ groups: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    expect((await remove()).status).toBe(200);
    const calls = mocks.managerQuery.mock.calls.map(([sql, values]) => [String(sql), values]);
    expect(calls[0][0]).toContain("FOR UPDATE");
    expect(calls[2]).toEqual([expect.stringContaining("DELETE FROM group_type"), [9]]);
    expect(calls[3][0]).toContain("settings.group_type.deleted");
    expect(calls[3][1]).toEqual([ADMIN, "9", "unknown"]);
  });

  it("refuses a type that groups still use", async () => {
    signIn(true);
    mocks.managerQuery
      .mockResolvedValueOnce([{ id: 9, type_name: "Women Wing", is_system: false }])
      .mockResolvedValueOnce([{ groups: 2 }]);
    const response = await remove();
    expect(response.status).toBe(409);
    expect((await response.json()).error.message).toBe("2 groups use this type, so it can't be deleted");
    expect(mocks.managerQuery).toHaveBeenCalledTimes(2);
  });

  it("never deletes a built-in type", async () => {
    signIn(true);
    mocks.managerQuery.mockResolvedValueOnce([{ id: 1, type_name: "Admin", is_system: true }]);
    expect((await remove("1")).status).toBe(403);
    expect(mocks.managerQuery).toHaveBeenCalledTimes(1);
  });

  it("turns the foreign key stopping a delete into 409", async () => {
    signIn(true);
    mocks.managerQuery
      .mockResolvedValueOnce([{ id: 9, type_name: "Women Wing", is_system: false }])
      .mockResolvedValueOnce([{ groups: 0 }])
      .mockRejectedValueOnce(Object.assign(new Error("fk"), { code: "23503" }));
    expect((await remove()).status).toBe(409);
  });

  it("refuses non-admins, View as, other origins and bad ids", async () => {
    signIn(false);
    expect((await remove()).status).toBe(403);
    signIn(true, { label: "Party", seatId: null });
    expect((await remove()).status).toBe(403);
    expect((await remove("9", "https://evil.example")).status).toBe(403);
    expect((await remove("0")).status).toBe(400);
    expect(mocks.managerQuery).not.toHaveBeenCalled();
  });
});
