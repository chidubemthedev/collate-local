// TODO(sms-sender-id): "Collate" must be registered as an approved alphanumeric
// sender ID in your Brevo account before going live. See README for instructions.
// Temporarily use a numeric sender if alphanumeric is not yet approved.
import type { SmsChannel, SmsSendInput, SmsSendResult } from "./channel";

const BREVO_SMS_URL = "https://api.brevo.com/v3/transactionalSMS/send";
const SENDER_NAME = process.env.BREVO_SMS_SENDER ?? "Collate";

interface BrevoSmsResponse {
  messageId: number;
  reference?: string;
}

interface BrevoErrorResponse {
  message?: string;
  code?: string;
}

export class BrevoSmsChannel implements SmsChannel {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send({ e164, text }: SmsSendInput): Promise<SmsSendResult> {
    const response = await fetch(BREVO_SMS_URL, {
      method: "POST",
      headers: {
        "api-key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        recipient: e164,
        sender: SENDER_NAME,
        content: text,
        type: "transactional",
      }),
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as BrevoErrorResponse;
      throw new Error(
        `Brevo SMS failed (${response.status}): ${error.message ?? response.statusText}`,
      );
    }

    const data = (await response.json()) as BrevoSmsResponse;
    return { providerMessageId: String(data.messageId) };
  }
}
