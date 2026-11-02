import type { Context } from "grammy";
import { parseOkCallback, applyOk } from "../ok";

export async function handleOkCallback(ctx: Context): Promise<void> {
  const deliveryId = parseOkCallback(ctx.callbackQuery?.data);
  const chatId = ctx.chat?.id ?? ctx.callbackQuery?.message?.chat.id;

  let applied = false;
  let failure: unknown;
  try {
    if (deliveryId && chatId !== undefined) {
      applied = await applyOk({ deliveryId, chatId });
    }
  } catch (error) {
    failure = error;
  } finally {
    await ctx.answerCallbackQuery();
  }

  if (failure) {
    throw failure;
  }

  if (applied) {
    try {
      await ctx.editMessageReplyMarkup({
        reply_markup: { inline_keyboard: [] },
      });
    } catch {
      // Best effort: the confirmation already succeeded.
    }
  }
}
