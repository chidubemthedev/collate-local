import "server-only";

export interface OtpSender {
  send(args: { channel: "email"; to: string; code: string }): Promise<void>;
}

export class ConsoleOtpSender implements OtpSender {
  async send({ code }: { channel: "email"; to: string; code: string }): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ConsoleOtpSender cannot run in production.");
    }

    console.info(`[auth] OTP code: ${code}`);
  }
}

export class BrevoOtpSender implements OtpSender {
  async send({ to, code }: { channel: "email"; to: string; code: string }): Promise<void> {
    const apiKey = process.env.BREVO_API_KEY;
    const fromEmail = process.env.BREVO_FROM_EMAIL ?? "no-reply@collate.local";
    const fromName = process.env.BREVO_FROM_NAME ?? "Collate";

    if (!apiKey) {
      throw new Error("BREVO_API_KEY must be set when OTP_DELIVERY is 'brevo'.");
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: to }],
        subject: "Your Collate one-time code",
        textContent: `Your Collate one-time code is ${code}. It expires in 10 minutes.`,
        htmlContent: `
          <p>Your Collate one-time code is <strong>${code}</strong>.</p>
          <p>It expires in 10 minutes.</p>
        `,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Brevo email send failed (${response.status}): ${errorBody}`);
    }
  }
}

export function getOtpSender(): OtpSender {
  switch (process.env.OTP_DELIVERY ?? "console") {
    case "console":
      return new ConsoleOtpSender();
    case "brevo":
      return new BrevoOtpSender();
    default:
      throw new Error(`Unsupported OTP_DELIVERY mode: ${process.env.OTP_DELIVERY}`);
  }
}
