import { InlineKeyboard } from "grammy";
import { getConsentText } from "../consent-text";
import { SHARE_NUMBER_KEYBOARD } from "./support";

export const REGISTERED_MESSAGE = "You are registered. You will receive messages here.";

export async function sendShareNumberPrompt(ctx: {
  reply(text: string, options?: { reply_markup?: unknown }): Promise<unknown>;
}): Promise<void> {
  await ctx.reply("Please tap the button below to share your number.", {
    reply_markup: SHARE_NUMBER_KEYBOARD,
  });
}

export async function sendConsentPrompt(ctx: {
  reply(text: string, options?: { reply_markup?: unknown }): Promise<unknown>;
}): Promise<void> {
  const keyboard = new InlineKeyboard()
    .text("Accept", "consent:accept")
    .text("Decline", "consent:decline");
  await ctx.reply(getConsentText(), { reply_markup: keyboard });
}

export async function sendRegistered(ctx: {
  reply(text: string, options?: { reply_markup?: unknown }): Promise<unknown>;
}): Promise<void> {
  await ctx.reply(REGISTERED_MESSAGE);
}
