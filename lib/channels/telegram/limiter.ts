const DEFAULT_MAX_PER_SECOND = 25;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * In-process token bucket. This limits one process only, so run exactly ONE
 * worker process for sends until a shared limiter exists. Flagged in README.
 */
export class TelegramLimiter {
  private readonly ratePerSecond: number;
  private tokens: number;
  private lastRefillAt: number;
  private pausedUntil = 0;

  constructor(ratePerSecond?: number) {
    const configured = Number(process.env.TELEGRAM_MAX_PER_SECOND);
    this.ratePerSecond =
      ratePerSecond && ratePerSecond > 0
        ? ratePerSecond
        : Number.isFinite(configured) && configured > 0
          ? configured
          : DEFAULT_MAX_PER_SECOND;
    this.tokens = this.ratePerSecond;
    this.lastRefillAt = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = Math.max(0, now - this.lastRefillAt) / 1000;
    this.tokens = Math.min(
      this.ratePerSecond,
      this.tokens + elapsedSeconds * this.ratePerSecond,
    );
    this.lastRefillAt = now;
  }

  async acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();
      if (now < this.pausedUntil) {
        await sleep(this.pausedUntil - now);
        continue;
      }

      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }

      const waitMs = Math.max(1, Math.ceil(((1 - this.tokens) / this.ratePerSecond) * 1000));
      await sleep(waitMs);
    }
  }

  pause(seconds: number): void {
    const duration = Math.max(0, seconds) * 1000;
    this.pausedUntil = Math.max(this.pausedUntil, Date.now() + duration);
  }
}

const globalForLimiter = globalThis as unknown as {
  __collateTelegramLimiter?: TelegramLimiter;
};

export function getTelegramLimiter(): TelegramLimiter {
  globalForLimiter.__collateTelegramLimiter ??= new TelegramLimiter();
  return globalForLimiter.__collateTelegramLimiter;
}
