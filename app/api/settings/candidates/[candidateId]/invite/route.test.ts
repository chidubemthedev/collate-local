import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAuth: vi.fn(),
  query: vi.fn(),
  managerQuery: vi.fn(),
  sendInviteEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth/api", () => ({
  requireApiAuth: mocks.requireApiAuth,
  readOnlyResponse: () => new Response(null, { status: 403 }),
}));
vi.mock("@/lib/invites/email", () => ({ sendInviteEmail: mocks.sendInviteEmail }));

import { DELETE, POST } from "./route";

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

const candidateRow = {
  id: 11,
  full_name: "TATA ALHAJI",
  person_email: null,
  principal_candidate_id: 10,
  principal_name: "KASHIM IBRAHIM MUHAMMAD",
  office_name: "Governor",
  level: 2,
  unit_name: "BAUCHI",
  unit_sort: "bauchi",
  family: 10,
  mate: 1,
  invite_email: "tata@example.com",
  invite_revoked: false,
  invite_accepted_at: null,
  invite_expires_at: new Date("2026-11-08T10:00:00Z"),
  invite_created_at: new Date("2026-11-07T10:00:00Z"),
  status: "invited",
};

function call(method: "POST" | "DELETE", id = "11", body?: unknown, origin: string | null = ORIGIN) {
  const request = new Request(`${ORIGIN}/api/settings/candidates/${id}/invite`, {
    method,
    headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
  const params = { params: Promise.resolve({ candidateId: id }) };
  return method === "POST" ? POST(request, params) : DELETE(request, params);
}

/** The transaction's answers for an invite that goes through. */
function inviteGoesThrough() {
  mocks.managerQuery
    .mockResolvedValueOnce([{ id: 11, email_address: null }]) // lock the candidate
    .mockResolvedValueOnce([]) // email not on any person
    .mockResolvedValueOnce([]) // no pending invite elsewhere
    .mockResolvedValueOnce([]) // cancel this candidate's old link
    .mockResolvedValueOnce([{ id: "link-1" }]) // new link
    .mockResolvedValueOnce([]); // audit log
}

describe("POST /api/settings/candidates/{id}/invite", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    // Links use the request's address unless SERVER_BASE_URL is set.
    vi.stubEnv("SERVER_BASE_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("points the link at SERVER_BASE_URL when it is set", async () => {
    vi.stubEnv("SERVER_BASE_URL", "https://collate.ng");
    signIn(true);
    inviteGoesThrough();
    mocks.query.mockResolvedValueOnce([candidateRow]);
    expect((await call("POST", "11", { email: "tata@example.com" })).status).toBe(201);
    expect(mocks.sendInviteEmail.mock.calls[0][0].link).toMatch(/^https:\/\/collate\.ng\/invite\/[A-Za-z0-9_-]{43}$/);
  });

  it("cancels any old link, stores only the token hash, emails the link and writes the audit log", async () => {
    signIn(true);
    inviteGoesThrough();
    mocks.query.mockResolvedValueOnce([candidateRow]);

    const response = await call("POST", "11", { email: " Tata@Example.com " });
    expect(response.status).toBe(201);
    expect((await response.json()).data).toMatchObject({ candidateId: 11, status: "invited", title: "Deputy Governor" });

    const calls = mocks.managerQuery.mock.calls.map(([sql, params]) => [String(sql), params]);
    expect(calls[0][0]).toContain("FOR UPDATE OF c");
    expect(calls[1][1]).toEqual(["tata@example.com"]);
    expect(calls[3][0]).toContain("SET is_revoked = TRUE");
    const [, insertParams] = calls[4] as [string, unknown[]];
    expect(insertParams[0]).toBe(11);
    expect(insertParams[1]).toBe("tata@example.com");
    expect(insertParams[2]).toMatch(/^[0-9a-f]{64}$/);
    const ttl = (insertParams[3] as Date).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(24 * 60 * 60 * 1000 - 5000);
    expect(ttl).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    expect(insertParams[4]).toBe(ADMIN);
    expect(calls[5][0]).toContain("settings.candidate.invited");

    const email = mocks.sendInviteEmail.mock.calls[0][0];
    expect(email).toMatchObject({ to: "tata@example.com", name: "Tata Alhaji", seat: "Deputy Governor, Bauchi" });
    expect(email.link).toMatch(/^http:\/\/localhost:3000\/invite\/[A-Za-z0-9_-]{43}$/);
    // The link's token is never stored: only its hash.
    expect(email.link).not.toContain(insertParams[2] as string);
  });

  it("cancels the new link when the email can't be sent", async () => {
    signIn(true);
    inviteGoesThrough();
    mocks.query.mockResolvedValueOnce([candidateRow]).mockResolvedValueOnce([]);
    mocks.sendInviteEmail.mockRejectedValueOnce(new Error("brevo down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await call("POST", "11", { email: "tata@example.com" });
    expect(response.status).toBe(500);
    expect((await response.json()).error.message).toBe("The invite email could not be sent. Try again.");
    expect(mocks.query.mock.calls[1]).toEqual([expect.stringContaining("SET is_revoked = TRUE WHERE id = $1"), ["link-1"]]);
    log.mockRestore();
  });

  it.each([
    [[[]], 404, "Candidate not found"],
    [[[{ id: 11, email_address: "tata@example.com" }]], 409, "This candidate has already registered"],
    [[[{ id: 11, email_address: null }], [{ "?column?": 1 }]], 409, "This email already belongs to someone else"],
    [[[{ id: 11, email_address: null }], [], [{ "?column?": 1 }]], 409, "This email already has a pending invite"],
  ])("refuses when the checks fail (%#)", async (answers, status, message) => {
    signIn(true);
    for (const answer of answers) mocks.managerQuery.mockResolvedValueOnce(answer);
    const response = await call("POST", "11", { email: "tata@example.com" });
    expect(response.status).toBe(status);
    expect((await response.json()).error.message).toBe(message);
    expect(mocks.sendInviteEmail).not.toHaveBeenCalled();
  });

  it("rejects a bad email, a bad id, other origins, non-admins and View as", async () => {
    signIn(true);
    const bad = await call("POST", "11", { email: "nope" });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.fields).toEqual({ email: "Enter a valid email address" });
    expect((await call("POST", "abc", { email: "a@b.co" })).status).toBe(400);
    expect((await call("POST", "11", { email: "a@b.co" }, "https://evil.example")).status).toBe(403);
    signIn(false);
    expect((await call("POST", "11", { email: "a@b.co" })).status).toBe(403);
    signIn(true, { label: "Party", seatId: null });
    expect((await call("POST", "11", { email: "a@b.co" })).status).toBe(403);
    expect(mocks.managerQuery).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/settings/candidates/{id}/invite", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("cancels the pending link and writes the audit log", async () => {
    signIn(true);
    mocks.managerQuery.mockResolvedValueOnce([[{ id: "link-1" }], 1]).mockResolvedValueOnce([]);
    expect((await call("DELETE")).status).toBe(200);
    expect(mocks.managerQuery.mock.calls[1][0]).toContain("settings.candidate.invite_cancelled");
  });

  it("returns 404 when there is nothing to cancel", async () => {
    signIn(true);
    mocks.managerQuery.mockResolvedValueOnce([[], 0]);
    expect((await call("DELETE")).status).toBe(404);
    expect(mocks.managerQuery).toHaveBeenCalledTimes(1);
  });

  it("is refused for non-admins and while using View as", async () => {
    signIn(false);
    expect((await call("DELETE")).status).toBe(403);
    signIn(true, { label: "Party", seatId: null });
    expect((await call("DELETE")).status).toBe(403);
    expect(mocks.managerQuery).not.toHaveBeenCalled();
  });
});
