import type { Context } from "grammy";

export async function handleOkCallback(ctx: Context): Promise<void> {
  // TODO(step 6): set the delivery to tapped_ok.
  await ctx.answerCallbackQuery();
}
