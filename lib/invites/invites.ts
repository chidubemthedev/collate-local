/**
 * Candidate invites: an admin enters a candidate's email, the app emails a single-use link that
 * lasts 24 hours, and the candidate completes registration from it. Pure helpers, shared by the
 * routes and their tests.
 */
import { createHash, randomBytes } from "node:crypto";

export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
export const INVITE_EMAIL_MAX = 254;
export const CANDIDATES_PAGE_SIZE = 25;
export const CANDIDATES_PAGE_SIZE_MAX = 100;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Where links in emails point. SERVER_BASE_URL (the public address, e.g. https://collate.ng) when
 * set; otherwise the address the admin is on, which is right locally but may be a preview URL.
 */
export function publicBaseUrl(requestUrl: string, configured = process.env.SERVER_BASE_URL): string {
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
      // Not a URL: fall back to the request's address.
    }
  }
  return new URL(requestUrl).origin;
}

/** The secret in the link. Only its hash is stored. */
export function createInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A token from a URL: 43 base64url characters, nothing else. */
export function isInviteTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** The email in an invite request, lower-cased, or an error message for the field. */
export function parseInviteEmail(body: unknown): { ok: true; email: string } | { ok: false; message: string } {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>).email : undefined;
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!email) return { ok: false, message: "Enter the candidate's email" };
  if (email.length > INVITE_EMAIL_MAX || !EMAIL_PATTERN.test(email)) return { ok: false, message: "Enter a valid email address" };
  return { ok: true, email };
}

export type InviteStatus = "not_invited" | "invited" | "expired" | "registered";

/**
 * Where a candidate stands. Registered once they have an email (they can sign in); otherwise by
 * their latest invite: none or cancelled is "not invited", past its 24 hours is "expired".
 */
export function inviteStatus(
  personEmail: string | null,
  latest: { isRevoked: boolean; acceptedAt: Date | string | null; expiresAt: Date | string } | null,
  now = Date.now(),
): InviteStatus {
  if (personEmail) return "registered";
  if (!latest || latest.isRevoked || latest.acceptedAt) return "not_invited";
  return new Date(latest.expiresAt).getTime() <= now ? "expired" : "invited";
}

/** Where an invite link stands when it is opened. */
export type LinkState = "valid" | "expired" | "used" | "cancelled";

export function linkState(
  link: { isRevoked: boolean; acceptedAt: Date | string | null; expiresAt: Date | string },
  now = Date.now(),
): LinkState {
  if (link.acceptedAt) return "used";
  if (link.isRevoked) return "cancelled";
  if (new Date(link.expiresAt).getTime() <= now) return "expired";
  return "valid";
}

export const LINK_STATE_MESSAGE: Record<Exclude<LinkState, "valid">, string> = {
  expired: "This invite has expired. Ask the admin for a new invite.",
  used: "This invite has already been used. Sign in with your email instead.",
  cancelled: "This invite was cancelled. Ask the admin for a new invite.",
};

/** Candidates are listed by office, then seat, with each running mate straight after their principal. */
export interface CandidateCursor {
  level: number;
  unit: string;
  family: number;
  mate: number;
  id: number;
}

export function encodeCandidateCursor(cursor: CandidateCursor): string {
  return Buffer.from(JSON.stringify([cursor.level, cursor.unit, cursor.family, cursor.mate, cursor.id]), "utf8").toString(
    "base64url",
  );
}

export function decodeCandidateCursor(value: string): CandidateCursor | null {
  if (value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      Array.isArray(parsed) &&
      parsed.length === 5 &&
      Number.isInteger(parsed[0]) &&
      typeof parsed[1] === "string" &&
      Number.isInteger(parsed[2]) &&
      (parsed[3] === 0 || parsed[3] === 1) &&
      Number.isInteger(parsed[4])
    ) {
      return { level: parsed[0], unit: parsed[1], family: parsed[2], mate: parsed[3], id: parsed[4] };
    }
  } catch {
    // Falls through to null.
  }
  return null;
}
