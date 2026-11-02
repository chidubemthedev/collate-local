import "dotenv/config";
import { getBot } from "../lib/channels/telegram/bot";
import { getTelegramConfig } from "../lib/channels/telegram/config";

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2).filter((argument) => argument !== "--");
    if (args.length !== 1) {
      throw new Error("Invalid webhook URL.");
    }

    const webhookUrl = new URL(args[0]);
    if (webhookUrl.protocol !== "https:") {
      throw new Error("Webhook URL must use HTTPS.");
    }

    const config = getTelegramConfig();
    await getBot().api.setWebhook(webhookUrl.toString(), {
      secret_token: config.webhookSecret,
      allowed_updates: ["message", "callback_query"],
    });
    console.log("Telegram webhook set successfully.");
  } catch {
    console.error("Telegram webhook setup failed.");
    process.exitCode = 1;
  }
}

void main();
