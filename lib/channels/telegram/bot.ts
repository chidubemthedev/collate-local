import { autoRetry } from "@grammyjs/auto-retry";
import { Bot, BotError } from "grammy";
import { getTelegramConfig } from "./config";
import { registerHandlers } from "./handlers";

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
    registerHandlers(bot);
    bot.catch(({ error }) => {
      const errorClassName =
        error instanceof Error ? error.constructor.name : typeof error;
      console.error(`[telegram] Update handler failed (${errorClassName})`);
    });
    const handleUpdate = bot.handleUpdate.bind(bot);
    bot.handleUpdate = async (update, webhookReplyEnvelope) => {
      try {
        await handleUpdate(update, webhookReplyEnvelope);
      } catch (error) {
        if (!(error instanceof BotError)) {
          throw error;
        }
        await bot.errorHandler(error);
      }
    };
    globalForTelegram.__collateTelegramBot = bot;
  }

  return globalForTelegram.__collateTelegramBot;
}
