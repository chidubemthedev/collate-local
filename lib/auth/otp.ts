import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { DataSource } from "typeorm";
import { getAuthSecret, OTP_LENGTH, OTP_MAX_ATTEMPTS } from "./config";

export interface UsableLoginOtp {
  id: string;
  person_id: string;
  code_hash: string;
}

export async function findLatestUsableOtp(
  dataSource: Pick<DataSource, "query">,
  personId: string,
): Promise<UsableLoginOtp | null> {
  const rows = await dataSource.query<UsableLoginOtp[]>(
    `
      WITH latest_otp AS (
        SELECT id, person_id, code_hash, expires_at, consumed_at, failed_attempt_count
        FROM login_otp
        WHERE person_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      )
      SELECT id, person_id, code_hash
      FROM latest_otp
      WHERE consumed_at IS NULL
        AND expires_at > NOW()
        AND failed_attempt_count < $2;
    `,
    [personId, OTP_MAX_ATTEMPTS],
  );
  return rows[0] ?? null;
}

export async function incrementLoginOtpFailedAttempts(
  dataSource: Pick<DataSource, "query">,
  otpId: string,
): Promise<boolean> {
  const rows = await dataSource.query<Array<{ id: string }>>(
    `
      UPDATE login_otp
      SET failed_attempt_count = failed_attempt_count + 1,
          consumed_at = CASE
            WHEN failed_attempt_count + 1 >= $2 THEN NOW()
            ELSE consumed_at
          END
      WHERE id = $1
        AND consumed_at IS NULL
        AND expires_at > NOW()
        AND failed_attempt_count < $2
      RETURNING id;
    `,
    [otpId, OTP_MAX_ATTEMPTS],
  );
  return rows.length > 0;
}

export async function consumeLoginOtp(
  dataSource: Pick<DataSource, "query">,
  otpId: string,
): Promise<boolean> {
  const rows = await dataSource.query<Array<{ id: string }>>(
    `
      UPDATE login_otp
      SET consumed_at = NOW()
      WHERE id = $1
        AND consumed_at IS NULL
        AND expires_at > NOW()
        AND failed_attempt_count < $2
      RETURNING id;
    `,
    [otpId, OTP_MAX_ATTEMPTS],
  );
  return rows.length > 0;
}

export function generateOtp(): string {
  const digits = Array.from({ length: OTP_LENGTH }, () => String(randomInt(0, 10)));
  return digits.join("");
}

export function hashOtp(personId: string, code: string): string {
  return createHmac("sha256", getAuthSecret()).update(`${personId}:${code}`).digest("hex");
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
