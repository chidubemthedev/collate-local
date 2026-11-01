import "server-only";
import { connection } from "next/server";
import { getDataSource } from "@/lib/db";
import { OTP_VERIFY_LIMIT_PER_IP, OTP_VERIFY_WINDOW_MS } from "@/lib/auth/config";
import { OtpVerifyBodySchema } from "@/lib/auth/schemas";
import { getClientIp } from "@/lib/auth/request";
import { consumeFixedWindowRateLimit, ipBucketKey } from "@/lib/auth/rate-limit";
import { verifyOtpHash } from "@/lib/auth/otp";
import { setSessionCookie } from "@/lib/auth/cookie";
import { createSessionToken, hashSessionToken } from "@/lib/auth/session";
import { failure, success } from "@/lib/api/response";

export async function POST(request: Request) {
  await connection();

  try {
    const body = await request.json();
    const parsed = OtpVerifyBodySchema.safeParse(body);
    if (!parsed.success) {
      return failure("invalid_or_expired_code", "Invalid or expired code");
    }

    const { email, code } = parsed.data;
    const now = new Date();
    const dataSource = await getDataSource();

    const personRows = await dataSource.query<Array<{ id: string; email_address: string | null }>>(
      `SELECT id, email_address FROM person WHERE LOWER(email_address) = $1 LIMIT 1;`,
      [email],
    );

    const person = personRows[0];
    if (!person) {
      return failure("invalid_or_expired_code", "Invalid or expired code");
    }

    const ipBucket = ipBucketKey("otp-verify-ip", getClientIp(request));
    const ipCheck = await consumeFixedWindowRateLimit(
      ipBucket,
      new Date(Math.floor(now.getTime() / OTP_VERIFY_WINDOW_MS) * OTP_VERIFY_WINDOW_MS),
      OTP_VERIFY_LIMIT_PER_IP,
    );
    if (!ipCheck.allowed) {
      const response = failure("too_many_requests", "Too many requests");
      response.headers.delete("Retry-After");
      return response;
    }

    const otpRows = await dataSource.query<Array<{ id: string; person_id: string; code_hash: string; expires_at: Date; consumed_at: Date | null }>>(
      `
        SELECT id, person_id, code_hash, expires_at, consumed_at
        FROM login_otp
        WHERE person_id = $1
        ORDER BY created_at DESC
        LIMIT 1;
      `,
      [person.id],
    );

    const currentOtp = otpRows[0];
    if (!currentOtp || currentOtp.consumed_at || new Date(currentOtp.expires_at).getTime() < now.getTime()) {
      return failure("invalid_or_expired_code", "Invalid or expired code");
    }

    const isValid = verifyOtpHash(person.id, code, currentOtp.code_hash);
    if (!isValid) {
      return failure("invalid_or_expired_code", "Invalid or expired code");
    }

    await dataSource.query(
      `UPDATE login_otp SET consumed_at = $1 WHERE id = $2;`,
      [now, currentOtp.id],
    );

    const sessionToken = createSessionToken();
    const sessionHash = hashSessionToken(sessionToken);
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    const lastActiveAt = new Date();

    await dataSource.query(
      `
        INSERT INTO auth_session (person_id, session_token_hash, expires_at, last_active_at, revoked_at, created_from_ip)
        VALUES ($1, $2, $3, $4, NULL, $5)
      `,
      [person.id, sessionHash, expiresAt, lastActiveAt, getClientIp(request) === "unknown" ? null : getClientIp(request)],
    );

    await setSessionCookie(sessionToken, expiresAt);

    return success({ ok: true });
  } catch (error) {
    console.error("[/api/auth/otp/verify] failed", error);
    return failure("internal_error", "An unexpected error occurred");
  }
}
