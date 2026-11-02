export interface SmsSendInput {
  e164: string;
  text: string;
}

export interface SmsSendResult {
  providerMessageId: string;
}

export interface SmsChannel {
  send(input: SmsSendInput): Promise<SmsSendResult>;
}

export class SmsNotConfiguredError extends Error {
  constructor() {
    super("SMS is not configured.");
    this.name = "SmsNotConfiguredError";
  }
}
