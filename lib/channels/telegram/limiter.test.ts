import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TelegramLimiter } from "./limiter";

describe("TelegramLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the configured rate and delays the next token", async () => {
    const limiter = new TelegramLimiter(2);

    await limiter.acquire();
    await limiter.acquire();

    let acquired = false;
    const third = limiter.acquire().then(() => {
      acquired = true;
    });

    await vi.advanceTimersByTimeAsync(400);
    expect(acquired).toBe(false);

    await vi.advanceTimersByTimeAsync(200);
    await third;
    expect(acquired).toBe(true);
  });

  it("stops acquisition while paused", async () => {
    const limiter = new TelegramLimiter(100);
    limiter.pause(1);

    let acquired = false;
    const next = limiter.acquire().then(() => {
      acquired = true;
    });

    await vi.advanceTimersByTimeAsync(500);
    expect(acquired).toBe(false);

    await vi.advanceTimersByTimeAsync(700);
    await next;
    expect(acquired).toBe(true);
  });
});
