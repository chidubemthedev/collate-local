import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireApiAuth: vi.fn(), managerQuery: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth/api", () => ({
  requireApiAuth: mocks.requireApiAuth,
  readOnlyResponse: () => new Response(null, { status: 403 }),
}));

import { DELETE } from "./route";

const ORIGIN = "http://localhost:3000";
const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const THIRD = "33333333-3333-4333-8333-333333333333";

function signIn(isAdmin: boolean, viewAs: { label: string; seatId: number | null } | null = null) {
  mocks.requireApiAuth.mockResolvedValue({
    ok: true,
    context: {
      isAdmin,
      viewAs,
      personId: ME,
      dataSource: {
        transaction: (work: (manager: { query: typeof mocks.managerQuery }) => unknown) =>
          work({ query: mocks.managerQuery }),
      },
    },
  });
}

function remove(personId: string, origin: string | null = ORIGIN) {
  return DELETE(
    new Request(`${ORIGIN}/api/settings/admins/${personId}`, {
      method: "DELETE",
      headers: origin ? { origin } : {},
    }),
    { params: Promise.resolve({ personId }) },
  );
}

describe("DELETE /api/settings/admins/{personId}", () => {
  beforeEach(() => {
    mocks.requireApiAuth.mockReset();
    mocks.managerQuery.mockReset();
  });

  it("removes every admin membership of the person, signs them out and writes the audit log", async () => {
    signIn(true);
    mocks.managerQuery
      .mockResolvedValueOnce([
        { id: 1, person_id: ME },
        { id: 7, person_id: OTHER },
        { id: 9, person_id: OTHER },
      ])
      .mockResolvedValue([]);

    const response = await remove(OTHER);
    expect(response.status).toBe(200);

    const calls = mocks.managerQuery.mock.calls.map(([sql, params]) => [String(sql), params]);
    expect(calls[0][0]).toContain("FOR UPDATE OF m");
    expect(calls[1]).toEqual([expect.stringContaining("DELETE FROM membership"), [[7, 9]]]);
    expect(calls[2]).toEqual([expect.stringContaining("DELETE FROM auth_session"), [OTHER]]);
    expect(calls[3][0]).toContain("settings.admin.removed");
    expect(calls[3][1]).toEqual([ME, OTHER, "unknown"]);
  });

  it("returns 404 for someone who is not an admin", async () => {
    signIn(true);
    mocks.managerQuery.mockResolvedValueOnce([
      { id: 1, person_id: ME },
      { id: 7, person_id: OTHER },
    ]);
    expect((await remove(THIRD)).status).toBe(404);
    expect(mocks.managerQuery).toHaveBeenCalledTimes(1);
  });

  it("never removes the last admin", async () => {
    signIn(true);
    mocks.managerQuery.mockResolvedValueOnce([
      { id: 7, person_id: OTHER },
      { id: 8, person_id: OTHER },
    ]);
    const response = await remove(OTHER);
    expect(response.status).toBe(409);
    expect((await response.json()).error.message).toBe("You can't remove the last admin");
    expect(mocks.managerQuery).toHaveBeenCalledTimes(1);
  });

  it("refuses to remove yourself", async () => {
    signIn(true);
    expect((await remove(ME)).status).toBe(403);
    expect(mocks.managerQuery).not.toHaveBeenCalled();
  });

  it("rejects an ID that is not a UUID", async () => {
    signIn(true);
    expect((await remove("12")).status).toBe(400);
    expect(mocks.requireApiAuth).not.toHaveBeenCalled();
  });

  it("refuses non-admins, admins using View as, and other origins", async () => {
    signIn(false);
    expect((await remove(OTHER)).status).toBe(403);
    signIn(true, { label: "Party", seatId: null });
    expect((await remove(OTHER)).status).toBe(403);
    expect((await remove(OTHER, "https://evil.example")).status).toBe(403);
    expect((await remove(OTHER, null)).status).toBe(403);
    expect(mocks.managerQuery).not.toHaveBeenCalled();
  });
});
