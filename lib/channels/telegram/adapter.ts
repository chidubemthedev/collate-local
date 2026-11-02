import { InlineKeyboard } from "grammy";
import type { ChannelAdapter, ChannelSendInput, ChannelSendResult } from "../types";
import { mapTelegramError } from "./errors";
import { getBot } from "./bot";

export interface TelegramSendApi {
  sendMessage(
    chatId: string | number,
    text: string,
    options?: { reply_markup?: InlineKeyboard },
  ): Promise<{ message_id: number }>;
}

let dryRunMessageCount = 0;

export function isTelegramDryRun(): boolean {
  if (process.env.TELEGRAM_DRY_RUN !== "true") {
    return false;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("TELEGRAM_DRY_RUN is not allowed in production.");
  }
  return true;
}

export class TelegramChannel implements ChannelAdapter {
  constructor(private readonly api?: TelegramSendApi) {}

  async send({
    chatId,
    text,
    okButtonDeliveryId,
  }: ChannelSendInput): Promise<ChannelSendResult> {
    if (isTelegramDryRun()) {
      dryRunMessageCount += 1;
      console.log(
        `[telegram] dry run: ${dryRunMessageCount} message(s) not sent`,
      );
      return { providerMessageId: `dry-run-${dryRunMessageCount}` };
    }

    try {
      const options = okButtonDeliveryId
        ? {
            reply_markup: new InlineKeyboard().text(
              "OK",
              `ok:${okButtonDeliveryId}`,
            ),
          }
        : undefined;
      const api = this.api ?? getBot().api;
      const message = await api.sendMessage(chatId, text, options);
      return { providerMessageId: String(message.message_id) };
    } catch (error) {
      throw mapTelegramError(error);
    }
  }

  async receive(): Promise<never> {
    throw new Error("Telegram receive is not implemented in v1.");
  }
}
