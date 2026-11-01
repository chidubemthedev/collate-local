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

export class TelegramChannel implements ChannelAdapter {
  constructor(private readonly api: TelegramSendApi = getBot().api) {}

  async send({
    chatId,
    text,
    okButtonDeliveryId,
  }: ChannelSendInput): Promise<ChannelSendResult> {
    try {
      const options = okButtonDeliveryId
        ? {
            reply_markup: new InlineKeyboard().text(
              "OK",
              `ok:${okButtonDeliveryId}`,
            ),
          }
        : undefined;
      const message = await this.api.sendMessage(chatId, text, options);
      return { providerMessageId: String(message.message_id) };
    } catch (error) {
      throw mapTelegramError(error);
    }
  }

  async receive(): Promise<never> {
    throw new Error("Telegram receive is not implemented in v1.");
  }
}
