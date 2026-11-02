export interface TelegramConfig {
  botToken: string;
  botUsername: string;
  webhookSecret: string;
}

let cachedConfig: TelegramConfig | undefined;

export function getTelegramConfig(): TelegramConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const botUsername = process.env.TELEGRAM_BOT_USERNAME?.trim();
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const missing = [
    ["TELEGRAM_BOT_TOKEN", botToken],
    ["TELEGRAM_BOT_USERNAME", botUsername],
    ["TELEGRAM_WEBHOOK_SECRET", webhookSecret],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (!botToken || !botUsername || !webhookSecret) {
    throw new Error(`Missing required Telegram configuration: ${missing.join(", ")}.`);
  }

  if (!/^[A-Za-z0-9_-]{16,256}$/.test(webhookSecret)) {
    throw new Error(
      "TELEGRAM_WEBHOOK_SECRET must be 16 to 256 characters using only letters, numbers, underscores, or hyphens.",
    );
  }

  cachedConfig = {
    botToken,
    botUsername,
    webhookSecret,
  };
  return cachedConfig;
}
