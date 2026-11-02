import "server-only";
import { cookies } from "next/headers";
import { getDataSource } from "@/lib/db";
import { getSessionCookieName } from "./config";
import { hashSessionToken, isSessionValid } from "./session";
import { UnauthorizedError } from "./errors";

export interface CurrentUser {
  personId: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (!token) {
    return null;
  }

  const dataSource = await getDataSource();
  const sessionRows = await dataSource.query<Array<{
    person_id: string;
    expires_at: Date;
    last_active_at: Date;
    revoked_at: Date | null;
  }>>(
    `
      SELECT person_id, expires_at, last_active_at, revoked_at
      FROM auth_session
      WHERE session_token_hash = $1
      ORDER BY created_at DESC
      LIMIT 1;
    `,
    [hashSessionToken(token)],
  );

  const session = sessionRows[0];
  if (
    !session ||
    !isSessionValid({
      revokedAt: session.revoked_at,
      expiresAt: session.expires_at,
      lastActiveAt: session.last_active_at,
    })
  ) {
    return null;
  }

  return { personId: session.person_id };
}

export async function requireUser(): Promise<CurrentUser> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new UnauthorizedError();
  }
  return currentUser;
}
