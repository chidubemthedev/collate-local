/**
 * Queue names live in one place so the app (enqueue side) and the worker
 * (handler side) can never drift apart on naming.
 */

/** Dev/ops smoke-test queue. Keeps no personal data in its payloads. */
export const TEST_JOB = "test-job";

/** Resolves a broadcast's audience into delivery rows. */
export const BROADCAST_RESOLVE = "broadcast-resolve";

/** Sends one prepared delivery through Telegram with an SMS fallback. */
export const DELIVERY_SEND = "delivery-send";

/** Every queue in the system. The worker creates each of these on startup. */
export const QUEUES = [TEST_JOB, BROADCAST_RESOLVE, DELIVERY_SEND] as const;

/**
 * Default retry policy applied to every job unless explicitly overridden on
 * the enqueue call.
 */
export const defaultJobOptions = {
  retryLimit: 5,
  retryDelay: 10,
  retryBackoff: true,
} as const;
