import { Bot } from "grammy";
import { beforeEach, describe, expect, it, vi } from "vitest";

const telegramMocks = vi.hoisted(() => ({
  getTelegramConfig: vi.fn(),
}));

vi.mock("../../../lib/channels/telegram/config", () => ({
  getTelegramConfig: telegramMocks.getTelegramConfig,
}));

const secret = "local-webhook-secret-123";
const apiCalls: Array<{ method: string; payload: Record<string, unknown> }> = [];
let failNextApiCall = false;
let bot: Bot;

async function postUpdate(update: object, secretHeader?: string): Promise<Response> {
  const { POST } = await import("../../../app/api/telegram/webhook/route");
  const headers = new Headers({ "content-type": "application/json" });
  if (secretHeader !== undefined) {
    headers.set("X-Telegram-Bot-Api-Secret-Token", secretHeader);
  }
  return POST(
    new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers,
      body: JSON.stringify(update),
    }),
  );
}

function messageUpdate(message: Record<string, unknown>, updateId = 1): object {
  return { update_id: updateId, message };
}

describe("Telegram webhook route", () => {
  beforeEach(async () => {
    vi.resetModules();
    telegramMocks.getTelegramConfig.mockReset();
    telegramMocks.getTelegramConfig.mockReturnValue({
      botToken: "test-token",
      botUsername: "test_bot",
      webhookSecret: secret,
    });
    apiCalls.length = 0;
    failNextApiCall = false;

    delete (globalThis as typeof globalThis & { __collateTelegramBot?: Bot })
      .__collateTelegramBot;
    const { getBot } = await import("./bot");
    bot = getBot();
    bot.api.config.use(async (_previous, method, payload) => {
      apiCalls.push({ method, payload: payload as Record<string, unknown> });
      if (failNextApiCall) {
        failNextApiCall = false;
        throw new Error("test API failure");
      }
      if (method === "getMe") {
        return {
          ok: true,
          result: {
            id: 1,
            is_bot: true,
            first_name: "Test bot",
            username: "test_bot",
            can_join_groups: false,
            can_read_all_group_messages: false,
            supports_inline_queries: false,
            can_connect_to_business: false,
            has_main_web_app: false,
            has_topics_enabled: false,
            allows_users_to_create_topics: false,
          },
        } as never;
      }
      if (method === "sendMessage") {
        return {
          ok: true,
          result: {
            message_id: 1,
            date: 1,
            chat: { id: 123, type: "private", first_name: "Test" },
          },
        } as never;
      }
      return { ok: true, result: true } as never;
    });
    await bot.init();
    apiCalls.length = 0;
  });

  it("does not read configuration when importing the route", async () => {
    vi.resetModules();
    telegramMocks.getTelegramConfig.mockClear();

    await import("../../../app/api/telegram/webhook/route");

    expect(telegramMocks.getTelegramConfig).not.toHaveBeenCalled();
  });

  it("rejects a request without the secret and does not run handlers", async () => {
    const response = await postUpdate(
      messageUpdate({
        message_id: 1,
        date: 1,
        chat: { id: 123, type: "private" },
        text: "/start",
      }),
    );

    expect(response.status).toBe(401);
    expect(apiCalls).toHaveLength(0);
  });

  it("rejects a request with the wrong secret", async () => {
    const response = await postUpdate({ update_id: 1 }, "wrong-secret");

    expect(response.status).toBe(401);
    expect(apiCalls).toHaveLength(0);
  });

  it("handles /start with a contact-request keyboard", async () => {
    const response = await postUpdate(
      messageUpdate({
        message_id: 1,
        date: 1,
        chat: { id: 123, type: "private", first_name: "Test" },
        from: { id: 123, is_bot: false, first_name: "Test" },
        text: "/start",
        entities: [{ offset: 0, length: 6, type: "bot_command" }],
      }),
      secret,
    );

    expect(response.status).toBe(200);
    expect(apiCalls).toHaveLength(1);
    expect(apiCalls[0].method).toBe("sendMessage");
    expect(apiCalls[0].payload.text).toBe(
      "Please tap the button below to share your number.",
    );
    expect(apiCalls[0].payload.reply_markup).toEqual({
      keyboard: [[{ text: "Share my number", request_contact: true }]],
      one_time_keyboard: true,
      resize_keyboard: true,
    });
  });

  it("replies to contact updates without logging the phone number", async () => {
    const phoneNumber = "+15555550123";
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await postUpdate(
        messageUpdate({
          message_id: 2,
          date: 1,
          chat: { id: 123, type: "private", first_name: "Test" },
          from: { id: 123, is_bot: false, first_name: "Test" },
          contact: {
            phone_number: phoneNumber,
            first_name: "Test",
            user_id: 123,
          },
        }, 2),
        secret,
      );

      expect(response.status).toBe(200);
      expect(apiCalls).toHaveLength(1);
      expect(apiCalls[0].method).toBe("sendMessage");
      expect(apiCalls[0].payload.text).toBe(
        "Thanks. We are checking your number.",
      );
      expect(JSON.stringify(logError.mock.calls)).not.toContain(phoneNumber);
    } finally {
      logError.mockRestore();
    }
  });

  it("returns 200 when a handler API call throws", async () => {
    failNextApiCall = true;
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await postUpdate(
      {
        update_id: 3,
        callback_query: {
          id: "callback-throw",
          from: { id: 123, is_bot: false, first_name: "Test" },
          chat_instance: "chat-instance",
          data: "ok:delivery-throw",
        },
      },
      secret,
    );

    expect(response.status).toBe(200);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0][0]).toMatch(
      /^\[telegram\] Update handler failed \(.+\)$/,
    );
    expect(JSON.stringify(logError.mock.calls)).not.toContain("test API failure");
    logError.mockRestore();
  });

  it("answers OK callbacks only", async () => {
    const response = await postUpdate(
      {
        update_id: 4,
        callback_query: {
          id: "callback-1",
          from: { id: 123, is_bot: false, first_name: "Test" },
          chat_instance: "chat-instance",
          data: "ok:delivery-1",
        },
      },
      secret,
    );

    expect(response.status).toBe(200);
    expect(apiCalls.map(({ method }) => method)).toEqual([
      "answerCallbackQuery",
    ]);
  });

  it("ignores an unknown update type", async () => {
    const response = await postUpdate(
      {
        update_id: 5,
        poll: {
          id: "poll-1",
          question: "Question",
          options: [],
          total_voter_count: 0,
          is_closed: false,
          is_anonymous: true,
          type: "regular",
          allows_multiple_answers: false,
        },
      },
      secret,
    );

    expect(response.status).toBe(200);
    expect(apiCalls).toHaveLength(0);
  });
});
