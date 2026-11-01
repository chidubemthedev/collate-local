import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { SESSION_IDLE_TIMEOUT_MS } from "./config";

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isSessionValid(session: {
  revokedAt: Date | string | null;
  expiresAt: Date | string;
  lastActiveAt: Date | string;
}): boolean {
  const now = Date.now();
  const revokedAt = session.revokedAt ? new Date(session.revokedAt).getTime() : null;
  const expiresAt = new Date(session.expiresAt).getTime();
  const lastActiveAt = new Date(session.lastActiveAt).getTime();

  if (revokedAt !== null && revokedAt <= now) {
    return false;
  }

  if (expiresAt <= now) {
    return false;
  }

  if (now - lastActiveAt > SESSION_IDLE_TIMEOUT_MS) {
    return false;
  }

  return true;
}
