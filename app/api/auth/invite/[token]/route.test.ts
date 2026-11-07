import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  managerQuery: vi.fn(),
  setSessionCookie: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/db", () => ({
  getDataSource: async () => ({
    query: mocks.query,
    transaction: (work: (manager: { query: typeof mocks.managerQuery }) => unknown) => work({ query: mocks.managerQuery }),
  }),
}));
vi.mock("@/lib/auth/cookie", () => ({ setSessionCookie: mocks.setSessionCookie }));
vi.mock("@/lib/auth/rate-limit", () => ({ consumeFixedWindowRateLimit: mocks.rateLimit, ipBucketKey: (p: string) => p }));

import { hashInviteToken } from "@/lib/invites/invites";
import { GET, POST } from "./route";

const ORIGIN = "http://localhost:3000";
const TOKEN = "A".repeat(43);
const PERSON = "33333333-3333-4333-8333-333333333333";

const soon = () => new Date(Date.now() + 60 * 60 * 1000);
const link = (overrides: Record<string, unknown> = {}) => ({
  id: "link-1",
  candidate_id: 11,
  email_address: "tata@example.com",
  expires_at: soon(),
  is_revoked: false,
  accepted_at: null,
  ...overrides,
});
const candidateRow = {
  id: 11,
  full_name: "TATA ALHAJI",
  person_email: null,
  principal_candidate_id: 10,
  principal_name: "KASHIM IBRAHIM MUHAMMAD",
  office_name: "Governor",
  unit_name: "BAUCHI",
  status: "invited",
};

const get = (token = TOKEN) =>
  GET(new Request(`${ORIGIN}/api/auth/invite/${token}`), { params: Promise.resolve({ token }) });
const post = (token = TOKEN, origin: string | null = ORIGIN) =>
  POST(
    new Request(`${ORIGIN}/api/auth/invite/${token}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
      body: "{}",
    }),
    { params: Promise.resolve({ token }) },
  );

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.rateLimit.mockResolvedValue({ allowed: true, hitCount: 1 });
});

describe("GET /api/auth/invite/{token}", () => {
  it("shows who the invite is for, with the email masked, looked up by the token's hash", async () => {
    const expires = soon();
    mocks.query.mockResolvedValueOnce([link({ expires_at: expires })]).mockResolvedValueOnce([candidateRow]);
    const response = await get();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      fullName: "Tata Alhaji",
      title: "Deputy Governor",
      seat: "Bauchi",
      email: "ta***@example.com",
      expiresAt: expires.toISOString(),
    });
    expect(mocks.query.mock.calls[0][1]).toEqual([hashInviteToken(TOKEN)]);
  });

  it.each([
    [{ expires_at: new Date(Date.now() - 1000) }, "This invite has expired. Ask the admin for a new invite."],
    [{ is_revoked: true }, "This invite was cancelled. Ask the admin for a new invite."],
    [{ accepted_at: new Date() }, "This invite has already been used. Sign in with your email instead."],
  ])("explains a link that can't be used (%#)", async (overrides, message) => {
    mocks.query.mockResolvedValueOnce([link(overrides)]);
    const response = await get();
    expect(response.status).toBe(409);
    expect((await response.json()).error.message).toBe(message);
  });

  it("returns 404 for an unknown or malformed token, and 429 when rate limited", async () => {
    mocks.query.mockResolvedValueOnce([]);
    expect((await get()).status).toBe(404);
    expect((await get("short")).status).toBe(404);
    mocks.rateLimit.mockResolvedValueOnce({ allowed: false, hitCount: 31 });
    expect((await get()).status).toBe(429);
  });
});

describe("POST /api/auth/invite/{token}", () => {
  function completes() {
    mocks.managerQuery
      .mockResolvedValueOnce([link()]) // lock the link
      .mockResolvedValueOnce([{ id: PERSON, email_address: null }]) // lock the person
      .mockResolvedValueOnce([]) // email still free
      .mockResolvedValue([]); // the writes
  }

  it("saves the email, uses up the link, signs the candidate in and writes the audit log", async () => {
    completes();
    const response = await post();
    expect(response.status).toBe(200);

    const calls = mocks.managerQuery.mock.calls.map(([sql, params]) => [String(sql), params]);
    expect(calls[0][0]).toContain("FOR UPDATE");
    expect(calls[3]).toEqual([expect.stringContaining("UPDATE person SET email_address"), ["tata@example.com", PERSON]]);
    expect(calls[4]).toEqual([expect.stringContaining("SET accepted_at = NOW()"), ["link-1"]]);
    expect(calls[5][0]).toContain("SET is_revoked = TRUE");
    expect(calls[6][0]).toContain("INSERT INTO auth_session");
    expect((calls[6][1] as unknown[])[0]).toBe(PERSON);
    expect(calls[7][0]).toContain("invite.accepted");
    expect(mocks.setSessionCookie).toHaveBeenCalledTimes(1);
    const [token] = mocks.setSessionCookie.mock.calls[0];
    // The cookie carries the token; the session row stores only its hash.
    expect((calls[6][1] as unknown[])[1]).not.toBe(token);
  });

  it("refuses when the email has been taken since the invite was sent", async () => {
    mocks.managerQuery
      .mockResolvedValueOnce([link()])
      .mockResolvedValueOnce([{ id: PERSON, email_address: null }])
      .mockResolvedValueOnce([{ "?column?": 1 }]);
    const response = await post();
    expect(response.status).toBe(409);
    expect((await response.json()).error.message).toBe("This email is now in use. Ask the admin for a new invite.");
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("turns a race on the unique email into the same message", async () => {
    mocks.managerQuery
      .mockResolvedValueOnce([link()])
      .mockResolvedValueOnce([{ id: PERSON, email_address: null }])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "23505", constraint: "uq_person_email_address_lower" }));
    const response = await post();
    expect(response.status).toBe(409);
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("refuses an expired or used link, and a candidate who already registered", async () => {
    mocks.managerQuery.mockResolvedValueOnce([link({ expires_at: new Date(Date.now() - 1000) })]);
    expect((await post()).status).toBe(409);
    mocks.managerQuery.mockResolvedValueOnce([link({ accepted_at: new Date() })]);
    expect((await post()).status).toBe(409);
    mocks.managerQuery
      .mockResolvedValueOnce([link()])
      .mockResolvedValueOnce([{ id: PERSON, email_address: "tata@example.com" }]);
    expect((await post()).status).toBe(409);
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("rejects other origins and unknown tokens", async () => {
    expect((await post(TOKEN, "https://evil.example")).status).toBe(403);
    expect((await post(TOKEN, null)).status).toBe(403);
    mocks.managerQuery.mockResolvedValueOnce([]);
    expect((await post()).status).toBe(404);
  });
});
