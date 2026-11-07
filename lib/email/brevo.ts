import "server-only";

/** Sends one email through Brevo. Needs BREVO_API_KEY; the sender comes from BREVO_FROM_*. */
export async function sendBrevoEmail(args: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY must be set when OTP_DELIVERY is 'brevo'.");
  const fromEmail = process.env.BREVO_FROM_EMAIL ?? "contact@lingoframe.com";
  const fromName = process.env.BREVO_FROM_NAME ?? "Collate";

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [args.toName ? { email: args.to, name: args.toName } : { email: args.to }],
      subject: args.subject,
      textContent: args.text,
      htmlContent: args.html,
    }),
  });
  if (!response.ok) {
    throw new Error(`Brevo email send failed (${response.status}): ${await response.text()}`);
  }
}
