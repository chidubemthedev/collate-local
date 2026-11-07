import "server-only";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { otpEmail } from "@/lib/email/template";

export interface OtpSender {
  send(args: { channel: "email"; to: string; code: string }): Promise<void>;
}

export class ConsoleOtpSender implements OtpSender {
  async send({
    code,
  }: {
    channel: "email";
    to: string;
    code: string;
  }): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ConsoleOtpSender cannot run in production.");
    }

    console.info(`[auth] OTP code: ${code}`);
  }
}

export class BrevoOtpSender implements OtpSender {
  async send({
    to,
    code,
  }: {
    channel: "email";
    to: string;
    code: string;
  }): Promise<void> {
    await sendBrevoEmail({ to, ...otpEmail(code) });
  }
}

export function getOtpSender(): OtpSender {
  switch (process.env.OTP_DELIVERY ?? "brevo") {
    case "console":
      return new ConsoleOtpSender();
    case "brevo":
      return new BrevoOtpSender();
    default:
      throw new Error(
        `Unsupported OTP_DELIVERY mode: ${process.env.OTP_DELIVERY}`,
      );
  }
}
