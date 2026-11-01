import type { Context } from "grammy";

export async function handleStart(ctx: Context): Promise<void> {
  await ctx.reply("Please tap the button below to share your number.", {
    reply_markup: {
      keyboard: [[{ text: "Share my number", request_contact: true }]],
      one_time_keyboard: true,
      resize_keyboard: true,
    },
  });
}
