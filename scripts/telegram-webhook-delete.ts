import "dotenv/config";
import { getBot } from "../lib/channels/telegram/bot";

async function main(): Promise<void> {
  try {
    await getBot().api.deleteWebhook();
    console.log("Telegram webhook deleted successfully.");
  } catch {
    console.error("Telegram webhook deletion failed.");
    process.exitCode = 1;
  }
}

void main();
