import "dotenv/config";
import { getBot } from "../lib/channels/telegram/bot";
import { getTelegramConfig } from "../lib/channels/telegram/config";

async function main(): Promise<void> {
  try {
    const config = getTelegramConfig();
    const botInfo = await getBot().api.getMe();
    const username = botInfo.username ?? "";
    const configuredUsername = config.botUsername.replace(/^@/, "");
    const matches =
      username.length > 0 &&
      username.toLowerCase() === configuredUsername.toLowerCase();

    console.log(`Bot username: ${username ? `@${username}` : "unavailable"}`);
    console.log(`TELEGRAM_BOT_USERNAME matches: ${matches}`);
    if (!matches) {
      process.exitCode = 1;
    }
  } catch {
    console.error("Telegram check failed.");
    process.exitCode = 1;
  }
}

void main();
