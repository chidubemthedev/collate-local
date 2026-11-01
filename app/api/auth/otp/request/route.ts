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

export async function POST(request: Request) {
  await connection();

  try {
    const body = await request.json();
    const parsed = OtpRequestBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
    }

    const email = parsed.data.email;
    const person = await findEligiblePersonByEmail(email);
    if (!person) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
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
      return Response.json({ ok: false, error: "too_many_requests" }, { status: 429 });
    }

    const ipCheck = await consumeFixedWindowRateLimit(
      ipBucket,
      new Date(Math.floor(now.getTime() / OTP_REQUEST_WINDOW_MS) * OTP_REQUEST_WINDOW_MS),
      OTP_REQUESTS_PER_HOUR_PER_IP,
    );
    if (!ipCheck.allowed) {
      return Response.json({ ok: false, error: "too_many_requests" }, { status: 429 });
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const codeHash = hashOtp(person.id, code);
    const clientIp = getClientIp(request);

    const dataSource = await getDataSource();
    await dataSource.query(
      `
        INSERT INTO login_otp (person_id, code_hash, expires_at, failed_attempt_count, requested_from_ip)
        VALUES ($1, $2, $3, 0, $4)
      `,
      [person.id, codeHash, expiresAt, clientIp === "unknown" ? null : clientIp],
    );

    await getOtpSender().send({ channel: "email", to: email, code });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[/api/auth/otp/request] failed", error);
    return Response.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
