import { SmsNotConfiguredError } from "./channel";
import type { SmsChannel, SmsSendInput, SmsSendResult } from "./channel";

export class NotConfiguredSmsChannel implements SmsChannel {
  async send(_input: SmsSendInput): Promise<SmsSendResult> {
    void _input;
    throw new SmsNotConfiguredError();
  }
}
