import "dotenv/config";
import { PgBoss } from "pg-boss";
import { QUEUES, TEST_JOB } from "../lib/queue/names";
import { handleTestJob } from "./jobs/test-job";

/**
 * Standalone worker process: consumes pg-boss jobs from the shared Postgres
 * database. It opens no HTTP server or port.
 *
 * Import discipline: this process must never import lib/db/index.ts or
 * lib/queue/index.ts - they import "server-only", which throws outside Next.js.
 * Only files free of "server-only" (lib/db/data-source.ts, lib/queue/names.ts,
 * worker/jobs/*) are safe here. Handlers are registered explicitly below so
 * each keeps its own payload typing via pg-boss's generics.
 */

const SHUTDOWN_TIMEOUT_MS = 15_000;

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error(
      "[worker] DATABASE_URL is not set. Copy .env.example to .env and fill in the connection string.",
    );
    process.exit(1);
  }

  // Same SSL convention as lib/db/data-source.ts.
  const ssl =
    process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false;

  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    ssl,
    // Keep the pool small to respect cloud provider connection limits (the
    // app's TypeORM pool shares the same database).
    max: 3,
  });
  boss.on("error", (error) => {
    console.error("[worker] pg-boss error", error);
  });

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown || !boss) {
      // Second signal or mid-startup failure: exit immediately.
      process.exitCode = 0;
      process.exit(0);
      return;
    }
    shuttingDown = true;
    console.log(`[worker] ${signal} received, draining jobs (max ${SHUTDOWN_TIMEOUT_MS / 1000}s)`);
    try {
      // Stop fetching new jobs and wait for in-flight ones to finish, bounded
      // by the timeout; `close: true` then shuts the connection pool down.
      await boss.stop({ close: true, graceful: true, timeout: SHUTDOWN_TIMEOUT_MS });
      console.log("[worker] stopped gracefully");
      process.exit(0);
    } catch (error) {
      console.error("[worker] error during shutdown", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  // Windows cannot have SIGTERM injected into it and its console maps
  // Ctrl+Break to SIGBREAK, so register the same graceful shutdown there.
  // SIGBREAK does not exist on POSIX, hence the platform guard.
  if (process.platform === "win32") {
    process.on("SIGBREAK", () => void shutdown("SIGBREAK"));
  }

  console.log("[worker] starting...");
  await boss.start();
  console.log("[worker] connected, ensuring queues exist");

  for (const queue of QUEUES) {
    // createQueue is idempotent (ON CONFLICT DO NOTHING in pg-boss).
    await boss.createQueue(queue);
  }

  // One registration line per job handler, so each keeps its own payload
  // typing through pg-boss's generic work<T>(). Add new jobs here as they
  // are introduced in later issues.
  await boss.work(TEST_JOB, handleTestJob);

  console.log("[worker] running. Waiting for jobs. Press Ctrl+C to stop.");
}

main().catch((error) => {
  console.error("[worker] fatal error during startup", error);
  process.exit(1);
});
