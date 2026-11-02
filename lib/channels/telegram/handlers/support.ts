import type { Context } from "grammy";
import type { ReplyKeyboardMarkup } from "grammy/types";

export const SHARE_NUMBER_KEYBOARD: ReplyKeyboardMarkup = {
  keyboard: [[{ text: "Share my number", request_contact: true }]],
  one_time_keyboard: true,
  resize_keyboard: true,
};

export function withErrorGuard(
  handler: (ctx: Context) => Promise<void>,
): (ctx: Context) => Promise<void> {
  return async (ctx: Context) => {
    try {
      await handler(ctx);
    } catch (error) {
      const errorClassName =
        error instanceof Error ? error.constructor.name : typeof error;
      console.error(`[telegram] Handler failed (${errorClassName})`);
    }
  };
}
