import "server-only";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { otpEmail } from "@/lib/email/template";

/** What a sign-in email carries: the code, and a link that signs in without typing it. */
export interface OtpMessage {
  channel: "email";
  to: string;
  code: string;
  link?: string;
}

export interface OtpSender {
  send(args: OtpMessage): Promise<void>;
}

export class ConsoleOtpSender implements OtpSender {
  async send({ code, link }: OtpMessage): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ConsoleOtpSender cannot run in production.");
    }

    console.info(`[auth] OTP code: ${code}`);
    if (link) console.info(`[auth] Sign-in link: ${link}`);
  }
}

export class BrevoOtpSender implements OtpSender {
  async send({ to, code, link }: OtpMessage): Promise<void> {
    await sendBrevoEmail({ to, ...otpEmail(code, link) });
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
