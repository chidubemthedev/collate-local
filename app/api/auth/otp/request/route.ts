import "server-only";
import { connection } from "next/server";
import { getDataSource } from "@/lib/db";
import {
  OTP_REQUESTS_PER_HOUR_PER_EMAIL,
  OTP_REQUESTS_PER_HOUR_PER_IP,
  OTP_REQUEST_WINDOW_MS,
  OTP_TTL_MS,
} from "@/lib/auth/config";
import { findEligiblePersonByEmail } from "@/lib/auth/eligibility";
import { OtpRequestBodySchema } from "@/lib/auth/schemas";
import { getClientIp } from "@/lib/auth/request";
import { consumeFixedWindowRateLimit, emailBucketKey, ipBucketKey } from "@/lib/auth/rate-limit";
import { generateOtp, hashOtp } from "@/lib/auth/otp";
import { getOtpSender } from "@/lib/auth/sender";
import { createSignInLinkToken, hashSignInLinkToken, signInLinkUrl } from "@/lib/auth/sign-in-link";
import { publicBaseUrl } from "@/lib/invites/invites";
import { failure, success } from "@/lib/api/response";

export async function POST(request: Request) {
  await connection();

  try {
    const body = await request.json();
    const parsed = OtpRequestBodySchema.safeParse(body);
    if (!parsed.success) {
      return failure("validation_failed", "Invalid request");
    }

    const email = parsed.data.email;
    const person = await findEligiblePersonByEmail(email);
    if (!person) {
      return failure("not_found", "Resource not found");
    }

    const now = new Date();
    const emailBucket = emailBucketKey("otp-request-email", email);
    const ipBucket = ipBucketKey("otp-request-ip", getClientIp(request));

    const emailCheck = await consumeFixedWindowRateLimit(
      emailBucket,
      new Date(Math.floor(now.getTime() / OTP_REQUEST_WINDOW_MS) * OTP_REQUEST_WINDOW_MS),
      OTP_REQUESTS_PER_HOUR_PER_EMAIL,
    );
    if (!emailCheck.allowed) {
      const response = failure("too_many_requests", "Too many requests");
      response.headers.delete("Retry-After");
      return response;
    }

    const ipCheck = await consumeFixedWindowRateLimit(
      ipBucket,
      new Date(Math.floor(now.getTime() / OTP_REQUEST_WINDOW_MS) * OTP_REQUEST_WINDOW_MS),
      OTP_REQUESTS_PER_HOUR_PER_IP,
    );
    if (!ipCheck.allowed) {
      const response = failure("too_many_requests", "Too many requests");
      response.headers.delete("Retry-After");
      return response;
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const codeHash = hashOtp(person.id, code);
    // The same email carries a sign-in link; it shares this row, so the two expire and are used up together.
    const linkToken = createSignInLinkToken();
    const clientIp = getClientIp(request);

    const dataSource = await getDataSource();
    await dataSource.query(
      `
        INSERT INTO login_otp (person_id, code_hash, link_token_hash, expires_at, failed_attempt_count, requested_from_ip)
        VALUES ($1, $2, $3, $4, 0, $5)
      `,
      [person.id, codeHash, hashSignInLinkToken(linkToken), expiresAt, clientIp === "unknown" ? null : clientIp],
    );

    await getOtpSender().send({
      channel: "email",
      to: email,
      code,
      link: signInLinkUrl(publicBaseUrl(request.url), linkToken),
    });

    return success({ ok: true });
  } catch (error) {
    console.error("[/api/auth/otp/request] failed", error);
    return failure("internal_error", "An unexpected error occurred");
  }
}
