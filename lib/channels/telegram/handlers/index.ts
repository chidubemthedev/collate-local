import type { Bot } from "grammy";
import { handleConsentDecision } from "./consent";
import { handleContact } from "./contact";
import { handleOkCallback } from "./ok-callback";
import { handleStart } from "./start";
import { withErrorGuard } from "./support";

export function registerHandlers(bot: Bot): void {
  bot.command("start", withErrorGuard(handleStart));
  bot.on("message:contact", withErrorGuard(handleContact));
  bot.callbackQuery(/^consent:(accept|decline)$/, withErrorGuard(handleConsentDecision));
  bot.callbackQuery(/^ok:/, withErrorGuard(handleOkCallback));
}
