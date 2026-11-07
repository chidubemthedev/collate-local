import "server-only";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { inviteEmail } from "@/lib/email/template";

/**
 * Emails a candidate their invite link. Uses the same delivery as sign-in codes (OTP_DELIVERY):
 * Brevo in production, or the server console in development.
 */
export async function sendInviteEmail(args: { to: string; name: string; seat: string; link: string }): Promise<void> {
  const mode = process.env.OTP_DELIVERY ?? "brevo";
  if (mode === "console") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Console email delivery cannot run in production.");
    }
    console.info(`[invite] To ${args.to}: ${args.link}`);
    return;
  }
  if (mode !== "brevo") throw new Error(`Unsupported OTP_DELIVERY mode: ${mode}`);

  await sendBrevoEmail({ to: args.to, toName: args.name, ...inviteEmail(args) });
}
