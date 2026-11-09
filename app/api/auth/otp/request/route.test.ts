import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findEligiblePersonByEmail: vi.fn(),
  rateLimit: vi.fn(),
  query: vi.fn(),
  send: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDataSource: async () => ({ query: mocks.query }) }));
vi.mock("@/lib/auth/eligibility", () => ({ findEligiblePersonByEmail: mocks.findEligiblePersonByEmail }));
vi.mock("@/lib/auth/rate-limit", () => ({
  consumeFixedWindowRateLimit: mocks.rateLimit,
  emailBucketKey: (prefix: string) => prefix,
  ipBucketKey: (prefix: string) => prefix,
}));
vi.mock("@/lib/auth/sender", () => ({ getOtpSender: () => ({ send: mocks.send }) }));

import { hashSignInLinkToken } from "@/lib/auth/sign-in-link";
import { POST } from "./route";

const PERSON = { id: "33333333-3333-4333-8333-333333333333" };

const request = (body: unknown = { email: " Ada@Example.com " }) =>
  POST(
    new Request("http://localhost:3000/api/auth/otp/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe("POST /api/auth/otp/request", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.rateLimit.mockResolvedValue({ allowed: true, hitCount: 1 });
    mocks.findEligiblePersonByEmail.mockResolvedValue(PERSON);
    mocks.query.mockResolvedValue([]);
    vi.stubEnv("SERVER_BASE_URL", "");
    // Sign-in codes are hashed with AUTH_SECRET, which tests don't load from .env.
    vi.stubEnv("AUTH_SECRET", "test-secret-test-secret-test-secret-123");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stores the code and a sign-in link token as hashes, and emails both", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(mocks.findEligiblePersonByEmail).toHaveBeenCalledWith("ada@example.com");

    const [sql, params] = mocks.query.mock.calls[0];
    expect(String(sql)).toContain("link_token_hash");
    expect(params[0]).toBe(PERSON.id);
    expect(params[1]).toMatch(/^[0-9a-f]{64}$/);
    expect(params[2]).toMatch(/^[0-9a-f]{64}$/);

    const message = mocks.send.mock.calls[0][0];
    expect(message).toMatchObject({ channel: "email", to: "ada@example.com" });
    expect(message.code).toMatch(/^\d{6}$/);
    const link = new URL(message.link);
    expect(`${link.origin}${link.pathname}`).toBe("http://localhost:3000/login/link");
    const token = link.searchParams.get("token") ?? "";
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // Only the hash of the link's token is stored.
    expect(params[2]).toBe(hashSignInLinkToken(token));
  });

  it("points the link at SERVER_BASE_URL when it is set", async () => {
    vi.stubEnv("SERVER_BASE_URL", "https://collate.ng");
    await request();
    expect(mocks.send.mock.calls[0][0].link).toMatch(/^https:\/\/collate\.ng\/login\/link\?token=[A-Za-z0-9_-]{43}$/);
  });

  it("sends nothing to an email that can't sign in, or when rate limited", async () => {
    mocks.findEligiblePersonByEmail.mockResolvedValueOnce(null);
    expect((await request()).status).toBe(404);
    mocks.rateLimit.mockResolvedValueOnce({ allowed: false, hitCount: 6 });
    expect((await request()).status).toBe(429);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
