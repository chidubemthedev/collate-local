import { NotConfiguredSmsChannel } from "./not-configured";
import type { SmsChannel } from "./channel";

// TODO(sms-provider): provider undecided; needs a sender ID on all four networks.

export function getSmsChannel(): SmsChannel {
  const provider = (process.env.SMS_PROVIDER ?? "none").trim().toLowerCase();
  switch (provider) {
    case "none":
    default:
      return new NotConfiguredSmsChannel();
  }
}
