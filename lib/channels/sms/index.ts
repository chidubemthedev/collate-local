import { NotConfiguredSmsChannel } from "./not-configured";
import { BrevoSmsChannel } from "./brevo";
import type { SmsChannel } from "./channel";

// TODO(sms-provider): Brevo is configured; set SMS_PROVIDER=brevo and BREVO_API_KEY to enable.

export function getSmsChannel(): SmsChannel {
  const provider = (process.env.SMS_PROVIDER ?? "none").trim().toLowerCase();
  switch (provider) {
    case "brevo":
      if (!process.env.BREVO_API_KEY) {
        throw new Error("BREVO_API_KEY is not set. Add it to your .env file.");
      }
      return new BrevoSmsChannel(process.env.BREVO_API_KEY);
    case "none":
    default:
      return new NotConfiguredSmsChannel();
  }
}
