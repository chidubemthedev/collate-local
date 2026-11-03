import type { Context } from "grammy";
import { decideContact } from "../link/decide";
import { hasAcceptedConsent, linkChatToPerson } from "../link/link";
import { sendConsentPrompt, sendNotRegistered, sendRegistered } from "./messages";

const CONTACT_RATE_LIMIT = 10;
const CONTACT_WINDOW_MS = 60 * 60 * 1000;

export async function handleContact(ctx: Context): Promise<void> {
  const senderId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (senderId === undefined || chatId === undefined) {
    return;
  }

  const { createHash } = await import("node:crypto");
  const senderHash = createHash("sha256").update(String(senderId)).digest("hex");
  const windowStartedAt = new Date(
    Math.floor(Date.now() / CONTACT_WINDOW_MS) * CONTACT_WINDOW_MS,
  );
  const { consumeFixedWindowRateLimit } = await import("../../../auth/rate-limit");
  const rateLimit = await consumeFixedWindowRateLimit(
    `telegram-contact:${senderHash}`,
    windowStartedAt,
    CONTACT_RATE_LIMIT,
  );
  if (!rateLimit.allowed) {
    return;
  }

  const decision = decideContact({
    contactUserId: ctx.message?.contact?.user_id,
    contactPhone: ctx.message?.contact?.phone_number,
    senderId,
    senderChatType: ctx.chat?.type,
  });
  if (decision.action === "ignore") {
    return;
  }

  const link = await linkChatToPerson({
    e164: decision.e164,
    chatId,
  });
  if (link.result === "no_match") {
    await sendNotRegistered(ctx);
    return;
  }
  if (link.result === "conflict") {
    return;
  }

  await ctx.reply("Number linked.", {
    reply_markup: { remove_keyboard: true },
  });

  if (!(await hasAcceptedConsent(link.personId))) {
    await sendConsentPrompt(ctx);
    return;
  }

  await sendRegistered(ctx);
}
