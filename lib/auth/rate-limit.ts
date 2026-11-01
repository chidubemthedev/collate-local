import "server-only";
import { getDataSource } from "@/lib/db";
import { hashBucketValue, normalizeEmailAddress } from "./config";

export async function consumeFixedWindowRateLimit(
  bucketKey: string,
  windowStartedAt: Date,
  limit: number,
): Promise<{ allowed: boolean; hitCount: number }> {
  const dataSource = await getDataSource();
  const result = (await dataSource.query(
    `
      INSERT INTO auth_rate_limit (bucket_key, window_started_at, hit_count)
      VALUES ($1, $2, 1)
      ON CONFLICT (bucket_key, window_started_at)
      DO UPDATE SET hit_count = auth_rate_limit.hit_count + 1
      RETURNING hit_count;
    `,
    [bucketKey, windowStartedAt],
  )) as unknown as Array<{ hit_count: string }>;

  const row = result[0];
  const hitCount = Number(row?.hit_count ?? 1);
  return { allowed: hitCount <= limit, hitCount };
}

export function emailBucketKey(prefix: string, email: string): string {
  return `${prefix}:${hashBucketValue(normalizeEmailAddress(email))}`;
}

export function ipBucketKey(prefix: string, ip: string): string {
  return `${prefix}:${hashBucketValue(ip)}`;
}
