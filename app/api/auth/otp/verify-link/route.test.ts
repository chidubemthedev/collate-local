import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  findUsableOtpByLinkToken: vi.fn(),
  consumeLoginOtp: vi.fn(),
  setSessionCookie: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDataSource: async () => ({ query: mocks.query }) }));
vi.mock("@/lib/auth/otp", () => ({
  findUsableOtpByLinkToken: mocks.findUsableOtpByLinkToken,
  consumeLoginOtp: mocks.consumeLoginOtp,
}));
vi.mock("@/lib/auth/cookie", () => ({ setSessionCookie: mocks.setSessionCookie }));
vi.mock("@/lib/auth/rate-limit", () => ({ consumeFixedWindowRateLimit: mocks.rateLimit, ipBucketKey: (p: string) => p }));

import { hashSignInLinkToken, SIGN_IN_LINK_UNUSABLE } from "@/lib/auth/sign-in-link";
import { GET, POST } from "./route";

const ORIGIN = "http://localhost:3000";
const TOKEN = "B".repeat(43);
const PERSON = "33333333-3333-4333-8333-333333333333";
const OTP = { id: "otp-1", person_id: PERSON, email_address: "ada.obi@example.com" };

const get = (token: string | null = TOKEN) =>
  GET(new Request(`${ORIGIN}/api/auth/otp/verify-link${token === null ? "" : `?token=${token}`}`));
const post = (body: unknown = { token: TOKEN }, origin: string | null = ORIGIN) =>
  POST(
    new Request(`${ORIGIN}/api/auth/otp/verify-link`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.rateLimit.mockResolvedValue({ allowed: true, hitCount: 1 });
});

describe("GET /api/auth/otp/verify-link", () => {
  it("shows who the link signs in, masked, without using it up", async () => {
    mocks.findUsableOtpByLinkToken.mockResolvedValueOnce(OTP);
    const response = await get();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ email: "ad***@example.com" });
    expect(mocks.findUsableOtpByLinkToken.mock.calls[0][1]).toBe(hashSignInLinkToken(TOKEN));
    expect(mocks.consumeLoginOtp).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("explains a link that can't be used, and refuses a malformed one without a lookup", async () => {
    mocks.findUsableOtpByLinkToken.mockResolvedValueOnce(null);
    const response = await get();
    expect(response.status).toBe(401);
    expect((await response.json()).error).toMatchObject({ code: "invalid_or_expired_code", message: SIGN_IN_LINK_UNUSABLE });
    expect((await get("short")).status).toBe(401);
    expect((await get(null)).status).toBe(401);
    expect(mocks.findUsableOtpByLinkToken).toHaveBeenCalledTimes(1);
  });

  it("is rate limited", async () => {
    mocks.rateLimit.mockResolvedValueOnce({ allowed: false, hitCount: 11 });
    expect((await get()).status).toBe(429);
  });
});

describe("POST /api/auth/otp/verify-link", () => {
  it("uses up the code, creates a session and sets the cookie", async () => {
    mocks.findUsableOtpByLinkToken.mockResolvedValueOnce(OTP);
    mocks.consumeLoginOtp.mockResolvedValueOnce(true);
    mocks.query.mockResolvedValueOnce([]);

    const response = await post();
    expect(response.status).toBe(200);
    expect(mocks.consumeLoginOtp.mock.calls[0][1]).toBe("otp-1");
    const [sql, params] = mocks.query.mock.calls[0];
    expect(String(sql)).toContain("INSERT INTO auth_session");
    expect(params[0]).toBe(PERSON);
    const [cookieToken] = mocks.setSessionCookie.mock.calls[0];
    // The cookie carries the session token; the row stores only its hash.
    expect(params[1]).not.toBe(cookieToken);
  });

  it("refuses a used, expired or replaced link (nothing found) and a link used at the same moment", async () => {
    mocks.findUsableOtpByLinkToken.mockResolvedValueOnce(null);
    expect((await post()).status).toBe(401);
    mocks.findUsableOtpByLinkToken.mockResolvedValueOnce(OTP);
    mocks.consumeLoginOtp.mockResolvedValueOnce(false);
    expect((await post()).status).toBe(401);
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("refuses other origins, bad bodies and malformed tokens before looking anything up", async () => {
    expect((await post({ token: TOKEN }, "https://evil.example")).status).toBe(403);
    expect((await post({ token: TOKEN }, null)).status).toBe(403);
    expect((await post("{not json")).status).toBe(401);
    expect((await post({ token: "short" })).status).toBe(401);
    expect(mocks.findUsableOtpByLinkToken).not.toHaveBeenCalled();
  });

  it("is rate limited", async () => {
    mocks.rateLimit.mockResolvedValueOnce({ allowed: false, hitCount: 11 });
    expect((await post()).status).toBe(429);
    expect(mocks.findUsableOtpByLinkToken).not.toHaveBeenCalled();
  });
});
