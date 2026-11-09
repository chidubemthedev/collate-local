import "server-only";
import { connection } from "next/server";
import { getDataSource } from "@/lib/db";
import { OTP_VERIFY_LIMIT_PER_IP, OTP_VERIFY_WINDOW_MS, SESSION_LIFETIME_MS } from "@/lib/auth/config";
import { setSessionCookie } from "@/lib/auth/cookie";
import { consumeLoginOtp, findUsableOtpByLinkToken } from "@/lib/auth/otp";
import { consumeFixedWindowRateLimit, ipBucketKey } from "@/lib/auth/rate-limit";
import { assertSameOrigin, getClientIp } from "@/lib/auth/request";
import { createSessionToken, hashSessionToken } from "@/lib/auth/session";
import { hashSignInLinkToken, isSignInLinkTokenShape, SIGN_IN_LINK_UNUSABLE } from "@/lib/auth/sign-in-link";
import { failure, success } from "@/lib/api/response";
import { maskEmail } from "@/lib/settings/admins";

/** Same per-IP limit as entering a code. */
async function rateLimited(request: Request): Promise<boolean> {
  const now = Date.now();
  const check = await consumeFixedWindowRateLimit(
    ipBucketKey("otp-verify-ip", getClientIp(request)),
    new Date(Math.floor(now / OTP_VERIFY_WINDOW_MS) * OTP_VERIFY_WINDOW_MS),
    OTP_VERIFY_LIMIT_PER_IP,
  );
  return !check.allowed;
}

/**
 * Who a sign-in link is for (masked email), or why it can't be used. Opening the link only shows
 * this: email scanners open links too, so signing in waits for the POST below.
 */
export async function GET(request: Request) {
  await connection();
  const token = new URL(request.url).searchParams.get("token");
  if (!isSignInLinkTokenShape(token)) return failure("invalid_or_expired_code", SIGN_IN_LINK_UNUSABLE);

  try {
    if (await rateLimited(request)) return failure("too_many_requests", "Too many requests");
    const dataSource = await getDataSource();
    const otp = await findUsableOtpByLinkToken(dataSource, hashSignInLinkToken(token));
    if (!otp) return failure("invalid_or_expired_code", SIGN_IN_LINK_UNUSABLE);
    return success({ email: maskEmail(otp.email_address) });
  } catch (error) {
    console.error("[/api/auth/otp/verify-link] GET failed", error);
    return failure("internal_error", "An unexpected error occurred");
  }
}

/** Signs in with a link: uses up the code it was sent with and starts a session. Body: { token }. */
export async function POST(request: Request) {
  await connection();
  try {
    assertSameOrigin(request);
  } catch {
    return failure("invalid_origin", "Request origin is not allowed");
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure("invalid_or_expired_code", SIGN_IN_LINK_UNUSABLE);
    }
    const token = body && typeof body === "object" ? (body as Record<string, unknown>).token : undefined;
    if (!isSignInLinkTokenShape(token)) return failure("invalid_or_expired_code", SIGN_IN_LINK_UNUSABLE);
    if (await rateLimited(request)) return failure("too_many_requests", "Too many requests");

    const dataSource = await getDataSource();
    const otp = await findUsableOtpByLinkToken(dataSource, hashSignInLinkToken(token));
    // consumeLoginOtp only succeeds once, so two clicks at the same moment can't both sign in.
    if (!otp || !(await consumeLoginOtp(dataSource, otp.id))) {
      return failure("invalid_or_expired_code", SIGN_IN_LINK_UNUSABLE);
    }

    const sessionToken = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
    const ip = getClientIp(request);
    await dataSource.query(
      `
        INSERT INTO auth_session (person_id, session_token_hash, expires_at, last_active_at, revoked_at, created_from_ip)
        VALUES ($1, $2, $3, NOW(), NULL, $4)
      `,
      [otp.person_id, hashSessionToken(sessionToken), expiresAt, ip === "unknown" ? null : ip],
    );
    await setSessionCookie(sessionToken, expiresAt);

    return success({ ok: true });
  } catch (error) {
    console.error("[/api/auth/otp/verify-link] POST failed", error);
    return failure("internal_error", "An unexpected error occurred");
  }
}
