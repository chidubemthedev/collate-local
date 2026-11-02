import "server-only";
import { PgBoss, type ConstructorOptions, type SendOptions } from "pg-boss";
import { defaultJobOptions } from "./names";

/**
 * Job payloads carry IDs only - never names, phone numbers or other personal
 * data. Payloads are stored in the database and visible to anyone with data
 * access, and agents must stay secret before election day. If a payload ever
 * grows beyond opaque IDs, that is a design smell.
 */

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill in the connection string from your database provider.",
  );
}

// pg-boss requires a direct (non-pooler) connection for advisory locks and
// SET commands. On Neon, set QUEUE_DATABASE_URL to the direct URL
// (remove "-pooler" from the hostname). Falls back to DATABASE_URL.
const queueDatabaseUrl = process.env.QUEUE_DATABASE_URL?.trim() || process.env.DATABASE_URL;

// Same convention as the TypeORM data source: enable SSL with a provider CA
// certificate in production instead of rejectUnauthorized:false.
const ssl =
  process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false;

// pg-boss passes its constructor options straight through to its pg.Pool, so
// pg pool options it does not declare in ConstructorOptions (idleTimeoutMillis)
// still take effect. Declaring them here keeps the literal type-checked.
type BossOptions = ConstructorOptions & { idleTimeoutMillis?: number };

const globalForQueue = globalThis as unknown as {
  __collateQueue?: Promise<PgBoss>;
  __collateQueuesCreated?: Set<string>;
};

async function startBoss(): Promise<PgBoss> {
  const options: BossOptions = {
    connectionString: queueDatabaseUrl,
    ssl,
    // Keep the pool small to respect cloud provider connection limits,
    // especially alongside the app's own TypeORM pool on the same database.
    max: 3,
    // Neon and other serverless Postgres providers close idle connections
    // after ~5 minutes. Recycle sooner to avoid ECONNRESET errors.
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  };
  const boss = new PgBoss(options);
  // pg-boss emits runtime/connection errors on this event; without a listener
  // an unhandled 'error' event would crash the Node process.
  boss.on("error", (error) => {
    console.error("[queue] pg-boss error", error);
  });
  await boss.start();
  return boss;
}

export function getBoss(): Promise<PgBoss> {
  // Cache the promise (not the instance) so concurrent calls during startup or
  // HMR share one start sequence and never open two pools.
  globalForQueue.__collateQueue ??= startBoss();
  return globalForQueue.__collateQueue;
}

/**
 * Make sure the queue exists (createQueue is idempotent in pg-boss), then send
 * the job with the default retry policy. Returns the job id, or null if the
 * send was deduplicated away by a singleton policy.
 */
export async function enqueue<T extends object>(
  queueName: string,
  data: T,
  options?: SendOptions,
): Promise<string | null> {
  const boss = await getBoss();
  // Track queues created in this process to avoid a CREATE round trip per
  // job; the database keeps surviving queues across restarts.
  const created = (globalForQueue.__collateQueuesCreated ??= new Set<string>());
  if (!created.has(queueName)) {
    await boss.createQueue(queueName);
    created.add(queueName);
  }
  return boss.send(queueName, data, { ...defaultJobOptions, ...options });
}
