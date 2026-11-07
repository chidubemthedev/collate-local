/**
 * Settings · Admins: the rules for adding an admin and for paging the list.
 * Pure helpers, shared by the API route and its tests.
 */
export const ADMIN_NAME_MAX = 120;
export const ADMIN_EMAIL_MAX = 254;
export const ADMINS_PAGE_SIZE = 25;
export const ADMINS_PAGE_SIZE_MAX = 100;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Same rule as the database check on phone numbers (E.164).
const PHONE_PATTERN = /^\+[1-9][0-9]{6,14}$/;

export interface NewAdmin {
  fullName: string;
  email: string;
  phone: string | null;
}

export type NewAdminResult =
  | { ok: true; value: NewAdmin }
  | { ok: false; fields: Partial<Record<keyof NewAdmin, string>> };

/** Checks and tidies the body of POST /api/settings/admins. */
export function parseNewAdmin(body: unknown): NewAdminResult {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const fields: Partial<Record<keyof NewAdmin, string>> = {};

  const fullName = typeof input.fullName === "string" ? input.fullName.trim().replace(/\s+/g, " ") : "";
  if (!fullName) fields.fullName = "Enter the admin's full name";
  else if (fullName.length > ADMIN_NAME_MAX) fields.fullName = `Use ${ADMIN_NAME_MAX} characters or fewer`;

  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!email) fields.email = "Enter the email they will sign in with";
  else if (email.length > ADMIN_EMAIL_MAX || !EMAIL_PATTERN.test(email)) fields.email = "Enter a valid email address";

  let phone: string | null = null;
  if (input.phone !== undefined && input.phone !== null && input.phone !== "") {
    phone = typeof input.phone === "string" ? input.phone.replace(/[\s-]/g, "") : "";
    if (!PHONE_PATTERN.test(phone)) fields.phone = "Use the international format, for example +2348031234567";
  }

  if (Object.keys(fields).length) return { ok: false, fields };
  return { ok: true, value: { fullName, email, phone } };
}

/** "ada.obi@gmail.com" -> "ad***@gmail.com". Emails are never returned in full. */
export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
}

/** Where the next page starts: after this name (lower case) and person id. */
export interface AdminCursor {
  name: string;
  id: string;
}

export function encodeAdminCursor(cursor: AdminCursor): string {
  return Buffer.from(JSON.stringify([cursor.name, cursor.id]), "utf8").toString("base64url");
}

export function decodeAdminCursor(value: string): AdminCursor | null {
  if (value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === "string" &&
      typeof parsed[1] === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed[1])
    ) {
      return { name: parsed[0], id: parsed[1] };
    }
  } catch {
    // Falls through to null.
  }
  return null;
}
