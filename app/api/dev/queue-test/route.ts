import { connection } from "next/server";
import { failure, internalError, success } from "@/lib/api/response";
import { enqueue, getBoss } from "@/lib/queue";
import { QUEUES, TEST_JOB } from "@/lib/queue/names";

type QueueReport =
  | {
      queue: string;
      counts: {
        deferred: number;
        queued: number;
        ready: number;
        active: number;
        failed: number;
        total: number;
      };
      /** When the counts were read; served from pg-boss's monitor cache, so at most ~1 min old. */
      capturedOn: string;
    }
  | { queue: string; error: string };

export function notFoundInProduction(): Response | null {
  // Dev-only utility: pretend this endpoint does not exist in production.
  return process.env.NODE_ENV === "production"
    ? failure("not_found", "Resource not found")
    : null;
}

// Next 16 note: with cacheComponents enabled, route segment config exports
// like `runtime` are not allowed; the Node.js runtime is the default. An
// issue-#1 pattern applies here: `connection()` opts the handler into
// request-time execution.
export async function POST(request: Request) {
  const blocked = notFoundInProduction();
  if (blocked) return blocked;

  try {
    await connection();

    let count = 1;
    let fail = false;
    try {
      const body = (await request.json()) as { count?: unknown; fail?: unknown };
      if (typeof body?.count === "number" && Number.isFinite(body.count)) {
        // Clamp to [1, 50] per the endpoint's contract.
        count = Math.min(50, Math.max(1, Math.trunc(body.count)));
      }
      if (typeof body?.fail === "boolean") fail = body.fail;
    } catch {
      // No JSON body: fall through with defaults (1 job, no fail).
    }

    const ids: (string | null)[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(await enqueue(TEST_JOB, { n: i + 1, fail }));
    }
    return success({ count: ids.length, ids });
  } catch {
    console.error("[/api/dev/queue-test] request failed");
    return internalError();
  }
}

/** Dev inspector: per-state job counts for every known queue. Visible from a plain browser GET. */
export async function GET() {
  const blocked = notFoundInProduction();
  if (blocked) return blocked;

  try {
    await connection();

    const boss = await getBoss();
    const queues: QueueReport[] = [];
    for (const queue of QUEUES) {
      try {
        // force: true keeps the monitor cache window tight (~1 minute) instead
        // of the monitor-interval-sized staleness the default read allows.
        const [snapshot] = await boss.getQueueStats(queue, { force: true });
        if (!snapshot) {
          queues.push({ queue, error: "Queue stats unavailable" });
          continue;
        }
        queues.push({
          queue,
          counts: {
            deferred: snapshot.deferredCount,
            queued: snapshot.queuedCount,
            ready: snapshot.readyCount,
            active: snapshot.activeCount,
            failed: snapshot.failedCount,
            total: snapshot.totalCount,
          },
          capturedOn: snapshot.capturedOn.toISOString(),
        });
      } catch {
        queues.push({
          queue,
          error: "Queue stats unavailable",
        });
      }
    }
    return success({ queues });
  } catch {
    console.error("[/api/dev/queue-test] request failed");
    return internalError();
  }
}
