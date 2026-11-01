import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { AUTH_SECRET, OTP_LENGTH } from "./config";

export function generateOtp(): string {
  const digits = Array.from({ length: OTP_LENGTH }, () => String(randomInt(0, 10)));
  return digits.join("");
}

export function hashOtp(personId: string, code: string): string {
  return createHmac("sha256", AUTH_SECRET).update(`${personId}:${code}`).digest("hex");
}

export function verifyOtpHash(personId: string, code: string, expectedHash: string): boolean {
  const actualHash = hashOtp(personId, code);
  const actual = Buffer.from(actualHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
