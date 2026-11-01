import "server-only";
import { createHash } from "node:crypto";

process.env.OTP_DELIVERY ??= process.env.BREVO_API_KEY ? "brevo" : "console";
process.env.TRUST_PROXY ??= "false";

let cachedAuthSecret: string | undefined;

export function getAuthSecret(): string {
  if (cachedAuthSecret) {
    return cachedAuthSecret;
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to a string with at least 32 characters.");
  }

  cachedAuthSecret = secret;
  return secret;
}

// ASSUMPTION: OTPs are 6 digits and valid for 10 minutes.
export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_REQUEST_COOLDOWN_MS = 60 * 1000;

// ASSUMPTION: OTP requests are capped at 5 per hour per email and 20 per hour per IP.
export const OTP_REQUESTS_PER_HOUR_PER_EMAIL = 5;
export const OTP_REQUESTS_PER_HOUR_PER_IP = 20;
export const OTP_REQUEST_WINDOW_MS = 60 * 60 * 1000;

// ASSUMPTION: verify attempts are capped at 10 per 15 minutes per IP.
export const OTP_VERIFY_LIMIT_PER_IP = 10;
export const OTP_VERIFY_WINDOW_MS = 15 * 60 * 1000;

// ASSUMPTION: session lifetime is 12 hours absolute and idle timeout is 2 hours.
export const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
export const SESSION_IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;

// ASSUMPTION: the OTP request endpoint should never answer faster than 400 ms.
export const OTP_REQUEST_MIN_RESPONSE_MS = 400;

export function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function hashBucketValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function getSessionCookieName(): string {
  return process.env.NODE_ENV === "production" ? "__Host-collate_session" : "collate_session";
}
