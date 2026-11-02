import { GrammyError, HttpError } from "grammy";
import { describe, expect, it, vi } from "vitest";
import { TelegramChannel, type TelegramSendApi } from "./adapter";
import {
  mapTelegramError,
  TelegramBlockedError,
  TelegramChatNotFoundError,
  TelegramPermanentError,
  TelegramRateLimitedError,
  TelegramTransientError,
} from "./errors";

function createGrammyError(errorCode: number, description: string, retryAfter?: number) {
  return new GrammyError(
    "sensitive details should not reach the mapped error",
    {
      ok: false,
      error_code: errorCode,
      description,
      parameters: retryAfter === undefined ? {} : { retry_after: retryAfter },
    },
    "sendMessage",
    {},
  );
}

function createSendApi(messageId: number) {
  const calls: Array<Parameters<TelegramSendApi["sendMessage"]>> = [];
  const sendMessage = vi.fn(
    async (...args: Parameters<TelegramSendApi["sendMessage"]>) => {
      calls.push(args);
      return { message_id: messageId };
    },
  );
  return { sendMessage, calls };
}

describe("TelegramChannel", () => {
  it("returns the provider message ID and adds the delivery OK callback button", async () => {
    const { sendMessage, calls } = createSendApi(321);
    const channel = new TelegramChannel({ sendMessage });

    await expect(
      channel.send({
        chatId: "12345",
        text: "Delivery update",
        okButtonDeliveryId: "delivery-abc",
      }),
    ).resolves.toEqual({ providerMessageId: "321" });

    const options = calls[0][2];
    expect(options?.reply_markup).toMatchObject({
      inline_keyboard: [[{ text: "OK", callback_data: "ok:delivery-abc" }]],
    });
  });

  it("sends without a keyboard when no delivery ID is supplied", async () => {
    const { sendMessage, calls } = createSendApi(99);
    const channel = new TelegramChannel({ sendMessage });

    await expect(
      channel.send({ chatId: 12345, text: "Notification" }),
    ).resolves.toEqual({ providerMessageId: "99" });
    expect(calls[0][2]).toBeUndefined();
  });

  it("wraps send errors using the generic Telegram error mapper", async () => {
    const token = "secret-bot-token";
    const sendMessage: TelegramSendApi["sendMessage"] = vi.fn(async () => {
      throw createGrammyError(400, `Request failed for ${token}`);
    });
    const channel = new TelegramChannel({ sendMessage });

    await expect(
      channel.send({ chatId: 12345, text: "private message text" }),
    ).rejects.toBeInstanceOf(TelegramPermanentError);
    await expect(
      mapTelegramError(createGrammyError(400, `Request failed for ${token}`)).message,
    ).not.toContain(token);
  });

  it("does not implement receiving in v1", async () => {
    const channel = new TelegramChannel({
      sendMessage: createSendApi(1).sendMessage,
    });
    await expect(channel.receive()).rejects.toThrow("not implemented in v1");
  });
});

describe("mapTelegramError", () => {
  it("maps rate limits and carries retry_after", () => {
    const error = mapTelegramError(createGrammyError(429, "Too many requests", 17));
    expect(error).toBeInstanceOf(TelegramRateLimitedError);
    expect((error as TelegramRateLimitedError).retryAfterSeconds).toBe(17);
  });

  it("maps 403 errors to blocked", () => {
    expect(mapTelegramError(createGrammyError(403, "Forbidden"))).toBeInstanceOf(
      TelegramBlockedError,
    );
  });

  it("maps a missing chat to TelegramChatNotFoundError", () => {
    expect(
      mapTelegramError(createGrammyError(400, "Bad Request: chat not found")),
    ).toBeInstanceOf(TelegramChatNotFoundError);
  });

  it("maps other client errors to permanent errors", () => {
    expect(mapTelegramError(createGrammyError(400, "Bad Request"))).toBeInstanceOf(
      TelegramPermanentError,
    );
  });

  it("maps server and transport errors to transient errors", () => {
    expect(mapTelegramError(createGrammyError(500, "Internal server error"))).toBeInstanceOf(
      TelegramTransientError,
    );
    expect(mapTelegramError(new HttpError("sensitive URL", new Error("network")))).toBeInstanceOf(
      TelegramTransientError,
    );
  });

  it("never includes the bot token, request URL, or response text in mapped messages", () => {
    const sensitiveText = "secret-bot-token https://api.telegram.org/bot123/sendMessage private text";
    for (const error of [
      createGrammyError(400, sensitiveText),
      new HttpError(sensitiveText, new Error(sensitiveText)),
    ]) {
      const mapped = mapTelegramError(error);
      expect(mapped.message).not.toContain("secret-bot-token");
      expect(mapped.message).not.toContain("api.telegram.org");
      expect(mapped.message).not.toContain("private text");
    }
  });
});
