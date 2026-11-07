/**
 * The layout every Collate email shares: brand header, one white card, a footer.
 * Built for email clients (Gmail, Outlook, phone mail apps): tables and inline styles only,
 * no external CSS or images, and a plain-text version alongside the HTML.
 */

const GREEN = "#1E8A55";
const INK = "#0A0A0A";
const MUTED = "#737373";
const LINE = "#E5E5E5";
const PAGE = "#F5F5F5";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

export interface EmailContent {
  /** Shown by mail apps next to the subject, before the email is opened. */
  preheader: string;
  heading: string;
  /** Plain-text paragraphs (escaped here); `**bold**` is allowed. */
  paragraphs: string[];
  /** A large one-time code, e.g. "482913". */
  code?: string;
  /** A button, with the link repeated as text under it for clients that block buttons. */
  button?: { label: string; href: string };
  /** Small print under the card body, e.g. when the link or code expires. */
  note?: string;
}

function inline(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${INK};font-weight:600;">$1</strong>`);
}

export function renderEmail(content: EmailContent): { html: string; text: string } {
  const paragraphs = content.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:24px;color:#404040;">${inline(paragraph)}</p>`,
    )
    .join("");

  const code = content.code
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
        <tr>
          <td align="center" style="background:#F0F7F3;border:1px solid #CFE5D9;border-radius:12px;padding:18px 12px;">
            <span style="font-family:'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace;font-size:32px;line-height:40px;font-weight:700;letter-spacing:10px;color:${INK};">${escapeHtml(content.code)}</span>
          </td>
        </tr>
      </table>`
    : "";

  const button = content.button
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
        <tr>
          <td align="center" bgcolor="${GREEN}" style="border-radius:10px;">
            <a href="${escapeHtml(content.button.href)}" target="_blank"
              style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:#FFFFFF;text-decoration:none;border-radius:10px;">${escapeHtml(content.button.label)}</a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 6px;font-size:13px;line-height:20px;color:${MUTED};">Or copy this link into your browser:</p>
      <p style="margin:0 0 18px;font-size:13px;line-height:20px;word-break:break-all;"><a href="${escapeHtml(content.button.href)}" target="_blank" style="color:${GREEN};text-decoration:underline;">${escapeHtml(content.button.href)}</a></p>`
    : "";

  const note = content.note
    ? `<p style="margin:4px 0 0;padding-top:16px;border-top:1px solid #F0F0F0;font-size:13px;line-height:20px;color:${MUTED};">${inline(content.note)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(content.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};font-family:${FONT};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${PAGE};">${escapeHtml(content.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
        <tr>
          <td style="padding:0 4px 18px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="36" height="36" align="center" bgcolor="${GREEN}" style="border-radius:9px;font-family:${FONT};font-size:14px;font-weight:700;color:#FFFFFF;">PU</td>
                <td style="padding-left:10px;font-family:${FONT};font-size:18px;font-weight:700;color:${INK};">Collate</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#FFFFFF;border:1px solid ${LINE};border-radius:14px;padding:28px 28px 24px;font-family:${FONT};">
            <h1 style="margin:0 0 14px;font-size:20px;line-height:28px;font-weight:700;color:${INK};">${escapeHtml(content.heading)}</h1>
            ${paragraphs}${code}${button}${note}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 4px 0;font-family:${FONT};font-size:12px;line-height:18px;color:#A3A3A3;">
            Collate · Polling unit coverage and campaign messaging<br>
            You received this email because your address was used on Collate. If that wasn't you, you can ignore it.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    content.heading,
    "",
    ...content.paragraphs.map((paragraph) => paragraph.replace(/\*\*(.+?)\*\*/g, "$1")),
    ...(content.code ? ["", content.code, ""] : []),
    ...(content.button ? [`${content.button.label}: ${content.button.href}`, ""] : []),
    ...(content.note ? [content.note.replace(/\*\*(.+?)\*\*/g, "$1"), ""] : []),
    "Collate · Polling unit coverage and campaign messaging",
  ].join("\n");

  return { html, text };
}

/** The sign-in code email. */
export function otpEmail(code: string): { subject: string; html: string; text: string } {
  return {
    subject: `${code} is your Collate sign-in code`,
    ...renderEmail({
      preheader: `Your sign-in code is ${code}. It expires in 10 minutes.`,
      heading: "Your sign-in code",
      paragraphs: ["Enter this code on the Collate sign-in page to continue."],
      code,
      note: "The code expires in **10 minutes** and works once. Never share it: Collate staff will never ask for it.",
    }),
  };
}

/** The candidate invite email. `seat` is e.g. "Deputy Governor, Bauchi". */
export function inviteEmail(args: { name: string; seat: string; link: string }): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: "You're invited to Collate",
    ...renderEmail({
      preheader: `Complete your registration as ${args.seat}. The link expires in 24 hours.`,
      heading: `You're invited, ${args.name}`,
      paragraphs: [
        `You've been invited to Collate as **${args.seat}**.`,
        "Collate shows coverage of polling units and lets you message the agents in your area. Complete your registration to get started.",
      ],
      button: { label: "Complete registration", href: args.link },
      note: "This link works once and expires in **24 hours**. After registering, you'll sign in with a code sent to this email.",
    }),
  };
}
