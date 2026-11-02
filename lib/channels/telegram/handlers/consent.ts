import type { Context } from "grammy";
import { findPersonByChatId, recordConsent } from "../link/link";

export async function handleConsentDecision(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  const answer = ctx.callbackQuery?.data === "consent:accept"
    ? true
    : ctx.callbackQuery?.data === "consent:decline"
      ? false
      : null;

  if (chatId === undefined || answer === null) {
    await ctx.answerCallbackQuery();
    return;
  }

  const personId = await findPersonByChatId(chatId);
  if (!personId) {
    await ctx.answerCallbackQuery();
    return;
  }

  await recordConsent({ personId, accepted: answer });
  await ctx.answerCallbackQuery();

  await ctx.editMessageText(
    answer
      ? "Consent recorded. You will receive messages here."
      : "Consent declined. You will not receive messages.",
    { reply_markup: { inline_keyboard: [] } },
  );
}
