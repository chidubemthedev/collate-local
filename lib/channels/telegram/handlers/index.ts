import type { Bot } from "grammy";
import { handleContact } from "./contact";
import { handleOkCallback } from "./ok-callback";
import { handleStart } from "./start";

export function registerHandlers(bot: Bot): void {
  bot.command("start", handleStart);
  bot.on("message:contact", handleContact);
  bot.callbackQuery(/^ok:/, handleOkCallback);
}
