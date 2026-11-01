import { webhookCallback } from "grammy";
import { getBot } from "../../../../lib/channels/telegram/bot";
import { getTelegramConfig } from "../../../../lib/channels/telegram/config";

let webhookHandler: ((request: Request) => Promise<Response>) | undefined;

function getWebhookHandler(): (request: Request) => Promise<Response> {
  if (!webhookHandler) {
    webhookHandler = webhookCallback(getBot(), "std/http", {
      secretToken: getTelegramConfig().webhookSecret,
      timeoutMilliseconds: 10_000,
      onTimeout: "return",
    });
  }
  return webhookHandler;
}

export async function POST(request: Request): Promise<Response> {
  return getWebhookHandler()(request);
}
