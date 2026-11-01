import type { Context } from "grammy";

export async function handleContact(ctx: Context): Promise<void> {
  // TODO(step 3): normalize to E.164, verify contact.user_id === from.id, look up phone_number, and store telegram_chat_id.
  await ctx.reply("Thanks. We are checking your number.");
}
