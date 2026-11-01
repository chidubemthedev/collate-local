import { autoRetry } from "@grammyjs/auto-retry";
import { Bot } from "grammy";
import { getTelegramConfig } from "./config";

type TelegramGlobal = typeof globalThis & {
  __collateTelegramBot?: Bot;
};

const globalForTelegram = globalThis as TelegramGlobal;

export function getBot(): Bot {
  if (!globalForTelegram.__collateTelegramBot) {
    const bot = new Bot(getTelegramConfig().botToken);
    bot.api.config.use(
      autoRetry({
        maxRetryAttempts: 2,
        maxDelaySeconds: 10,
      }),
    );
    globalForTelegram.__collateTelegramBot = bot;
  }

  return globalForTelegram.__collateTelegramBot;
}
