import { createHash, randomBytes } from "node:crypto";

/**
 * The link in a sign-in email: a random token whose SHA-256 hash is stored on the code's row
 * (login_otp.link_token_hash). Pure helpers, shared by the routes and their tests.
 */
export const SIGN_IN_LINK_PATH = "/login/link";

export function createSignInLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSignInLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A token from a URL: 43 base64url characters, nothing else. */
export function isSignInLinkTokenShape(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function signInLinkUrl(baseUrl: string, token: string): string {
  return `${baseUrl}${SIGN_IN_LINK_PATH}?token=${encodeURIComponent(token)}`;
}

export const SIGN_IN_LINK_UNUSABLE =
  "This sign-in link has expired or was already used. Request a new code to sign in.";
