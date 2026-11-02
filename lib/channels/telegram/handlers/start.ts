import type { Context } from "grammy";
import { hasAcceptedConsent, findPersonByChatId } from "../link/link";
import {
  sendConsentPrompt,
  sendRegistered,
  sendShareNumberPrompt,
} from "./messages";

export async function handleStart(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) {
    return;
  }

  const personId = await findPersonByChatId(chatId);
  if (!personId) {
    await sendShareNumberPrompt(ctx);
    return;
  }

  if (await hasAcceptedConsent(personId)) {
    await sendRegistered(ctx);
    return;
  }

  await sendConsentPrompt(ctx);
}
