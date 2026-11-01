import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const telegramEnvNames = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_BOT_USERNAME",
  "TELEGRAM_WEBHOOK_SECRET",
] as const;
const originalEnv = new Map(
  telegramEnvNames.map((name) => [name, process.env[name]]),
);

describe("getTelegramConfig", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const name of telegramEnvNames) {
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const name of telegramEnvNames) {
      const value = originalEnv.get(name);
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  it("does not validate environment configuration at import time", async () => {
    await expect(import("./config")).resolves.toBeDefined();
  });

  it.each(telegramEnvNames)("rejects missing %s", async (name) => {
    process.env.TELEGRAM_BOT_TOKEN = "placeholder-token";
    process.env.TELEGRAM_BOT_USERNAME = "placeholder_bot";
    process.env.TELEGRAM_WEBHOOK_SECRET = "placeholder-secret-value";
    delete process.env[name];

    const { getTelegramConfig } = await import("./config");
    expect(() => getTelegramConfig()).toThrow(name);
  });

  it.each(["short", "contains spaces in secret", "symbols!@#$%^&*()"])(
    "rejects an invalid webhook secret",
    async (webhookSecret) => {
      process.env.TELEGRAM_BOT_TOKEN = "placeholder-token";
      process.env.TELEGRAM_BOT_USERNAME = "placeholder_bot";
      process.env.TELEGRAM_WEBHOOK_SECRET = webhookSecret;

      const { getTelegramConfig } = await import("./config");
      expect(() => getTelegramConfig()).toThrow("TELEGRAM_WEBHOOK_SECRET");
    },
  );

  it("returns and caches valid configuration", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "placeholder-token";
    process.env.TELEGRAM_BOT_USERNAME = "placeholder_bot";
    process.env.TELEGRAM_WEBHOOK_SECRET = "A".repeat(16);

    const { getTelegramConfig } = await import("./config");
    const config = getTelegramConfig();
    process.env.TELEGRAM_BOT_TOKEN = "changed-token";

    expect(getTelegramConfig()).toBe(config);
    expect(config.botUsername).toBe("placeholder_bot");
  });
});
