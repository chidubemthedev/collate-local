import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentIp: "203.0.113.1",
  getDataSource: vi.fn(),
  consumeRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  verifyOtpHash: vi.fn(),
  setSessionCookie: vi.fn(),
  createSessionToken: vi.fn(),
  hashSessionToken: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDataSource: mocks.getDataSource }));
vi.mock("@/lib/auth/request", () => ({ getClientIp: mocks.getClientIp }));
vi.mock("@/lib/auth/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/rate-limit")>(
    "@/lib/auth/rate-limit",
  );
  return {
    ...actual,
    consumeFixedWindowRateLimit: mocks.consumeRateLimit,
  };
});
vi.mock("@/lib/auth/otp", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/otp")>(
    "@/lib/auth/otp",
  );
  return { ...actual, verifyOtpHash: mocks.verifyOtpHash };
});
vi.mock("@/lib/auth/cookie", () => ({
  setSessionCookie: mocks.setSessionCookie,
}));
vi.mock("@/lib/auth/session", () => ({
  createSessionToken: mocks.createSessionToken,
  hashSessionToken: mocks.hashSessionToken,
}));

import { emailBucketKey } from "@/lib/auth/rate-limit";
import { POST } from "./route";

const email = "otp-test@example.test";
const validCode = Array.from({ length: 6 }, (_, index) => String(index)).join("");
const wrongCode = validCode.replace(/[0-9]/g, (digit) =>
  String((Number(digit) + 1) % 10),
);

class FakeOtpStore {
  personExists = true;
  otp: {
    id: string;
    codeHash: string;
    expiresAt: Date;
    consumedAt: Date | null;
    failedAttemptCount: number;
  } | null = this.createOtp();
  statements: string[] = [];

  createOtp() {
    return {
      id: "otp-row",
      codeHash: "stored-hash",
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      failedAttemptCount: 0,
    };
  }

  async query<T = unknown>(sql: string): Promise<T> {
    this.statements.push(sql);

    if (sql.includes("SELECT id, email_address FROM person")) {
      return (this.personExists
        ? [{ id: "person-row", email_address: email }]
        : []) as T;
    }

    if (sql.includes("WITH latest_otp")) {
      const otp = this.otp;
      const usable =
        otp &&
        !otp.consumedAt &&
        otp.expiresAt.getTime() > Date.now() &&
        otp.failedAttemptCount < 5;
      return (usable
        ? [{ id: otp.id, person_id: "person-row", code_hash: otp.codeHash }]
        : []) as T;
    }

    if (sql.includes("failed_attempt_count = failed_attempt_count + 1")) {
      const otp = this.otp;
      if (
        otp &&
        !otp.consumedAt &&
        otp.expiresAt.getTime() > Date.now() &&
        otp.failedAttemptCount < 5
      ) {
        otp.failedAttemptCount += 1;
        if (otp.failedAttemptCount >= 5) {
          otp.consumedAt = new Date();
        }
        return [{ id: otp.id }] as T;
      }
      return [] as T;
    }

    if (sql.includes("SET consumed_at = NOW()")) {
      const otp = this.otp;
      if (
        otp &&
        !otp.consumedAt &&
        otp.expiresAt.getTime() > Date.now() &&
        otp.failedAttemptCount < 5
      ) {
        otp.consumedAt = new Date();
        return [{ id: otp.id }] as T;
      }
      return [] as T;
    }

    if (sql.includes("INSERT INTO auth_session")) {
      return [] as T;
    }

    throw new Error("Unexpected query in OTP verification test");
  }
}

let store: FakeOtpStore;
let rateLimitBuckets: Map<string, number>;

function request(code = wrongCode): Request {
  return new Request("http://localhost/api/auth/otp/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
}

async function post(code?: string) {
  return POST(request(code));
}

beforeEach(() => {
  store = new FakeOtpStore();
  rateLimitBuckets = new Map();
  mocks.currentIp = "203.0.113.1";
  mocks.getDataSource.mockResolvedValue(store);
  mocks.getClientIp.mockImplementation(() => mocks.currentIp);
  mocks.consumeRateLimit.mockImplementation(async (bucketKey: string, _window: Date, limit: number) => {
    const hitCount = (rateLimitBuckets.get(bucketKey) ?? 0) + 1;
    rateLimitBuckets.set(bucketKey, hitCount);
    return { allowed: hitCount <= limit, hitCount };
  });
  mocks.verifyOtpHash.mockImplementation(
    (_personId: string, code: string) => code === validCode,
  );
  mocks.createSessionToken.mockReturnValue("x".repeat(32));
  mocks.hashSessionToken.mockReturnValue("session-hash");
  mocks.setSessionCookie.mockResolvedValue(undefined);
});

describe("OTP verification", () => {
  it("burns an OTP after five wrong codes and keeps failures identical", async () => {
    const wrongResponses = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      wrongResponses.push(await post());
    }

    const bodies = await Promise.all(wrongResponses.map((response) => response.json()));
    const baseline = bodies[0];
    for (const [index, response] of wrongResponses.entries()) {
      expect(response.status).toBe(401);
      expect(bodies[index]).toEqual(baseline);
    }

    const correctAfterBurn = await post(validCode);
    expect(correctAfterBurn.status).toBe(401);
    expect(await correctAfterBurn.json()).toEqual(baseline);
    expect(store.otp?.failedAttemptCount).toBe(5);
    expect(store.otp?.consumedAt).not.toBeNull();
    expect(
      store.statements.some(
        (sql) =>
          sql.includes("failed_attempt_count = failed_attempt_count + 1") &&
          sql.includes("RETURNING id"),
      ),
    ).toBe(true);
  });

  it("returns the same unauthorized response for other invalid OTP states", async () => {
    const responses = [];
    store.personExists = false;
    responses.push(await post(validCode));
    store.personExists = true;
    store.otp = null;
    responses.push(await post(validCode));
    store.otp = store.createOtp();
    store.otp.expiresAt = new Date(Date.now() - 1);
    responses.push(await post(validCode));
    store.otp = store.createOtp();
    store.otp.consumedAt = new Date();
    responses.push(await post(validCode));
    store.otp = store.createOtp();
    store.otp.failedAttemptCount = 5;
    responses.push(await post(validCode));

    const bodies = await Promise.all(responses.map((response) => response.json()));
    const baseline = bodies[0];
    for (const [index, response] of responses.entries()) {
      expect(response.status).toBe(401);
      expect(bodies[index]).toEqual(baseline);
    }
  });

  it("consumes a correct OTP only once, including parallel verification", async () => {
    const responses = await Promise.all([post(validCode), post(validCode)]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
    expect(store.otp?.consumedAt).not.toBeNull();
    expect(mocks.setSessionCookie).toHaveBeenCalledTimes(1);
    expect(
      store.statements.some(
        (sql) => sql.includes("WHERE id = $1") && sql.includes("RETURNING id"),
      ),
    ).toBe(true);
  });

  it("does not allow parallel wrong-code attempts to exceed the limit", async () => {
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => post()),
    );
    expect(responses.every((response) => response.status === 401)).toBe(true);
    expect(store.otp?.failedAttemptCount).toBe(5);
    expect(store.otp?.consumedAt).not.toBeNull();
  });

  it("limits the same email across different IP addresses", async () => {
    let finalResponse: Response | undefined;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      mocks.currentIp = `203.0.113.${attempt + 1}`;
      finalResponse = await post();
    }

    expect(finalResponse?.status).toBe(429);
    expect(finalResponse?.headers.get("Retry-After")).toBe("60");
    const emailBucket = emailBucketKey("otp-verify-email", email);
    expect(rateLimitBuckets.get(emailBucket)).toBe(11);
  });
});
