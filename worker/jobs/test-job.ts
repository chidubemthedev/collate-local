import type { Job } from "pg-boss";

/**
 * Payload contract: an opaque test flag plus nothing personal. Keep any real
 * job payload aligned with the rule in lib/queue/index.ts (IDs only).
 */
export interface TestJobData {
  /** Sequence number of the send, kept in the payload so the test is insensitive to timing. */
  n?: number;
  /** When true the handler throws, to exercise retries and terminal failure. */
  fail?: boolean;
}

/**
 * pg-boss batch handler: receives every job claimed in one poll. Throwing here
 * fails the whole claim at once, so each failed job is retried as a batch -
 * fine for a test job with a single item per claim.
 */
export async function handleTestJob(jobs: Job<TestJobData>[]): Promise<void> {
  for (const job of jobs) {
    const { n, fail } = job.data;
    if (fail) {
      // Log before throwing so retry pacing is observable in the worker log.
      console.log(
        `[test-job] job ${job.id} (n=${n ?? "?"}) intentionally failing on attempt ${job.retryCount + 1}`,
      );
      throw new Error(
        `test job ${job.id} (n=${n ?? "?"}) intentionally failed on attempt ${job.retryCount + 1}`,
      );
    }
    console.log(`[test-job] processed job ${job.id} (n=${n ?? "?"})`);
  }
}
