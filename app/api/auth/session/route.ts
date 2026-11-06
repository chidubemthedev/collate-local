import "server-only";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { getDataSource } from "@/lib/db";
import { getSessionCookieName } from "@/lib/auth/config";
import { hashSessionToken, isSessionValid, shouldRefreshSessionActivity } from "@/lib/auth/session";
import { internalError, success } from "@/lib/api/response";

export async function GET() {
  await connection();

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getSessionCookieName())?.value;
    if (!token) {
      return success({ authenticated: false });
    }

    const dataSource = await getDataSource();
    // Session, person and admin flag in one round trip.
    const sessionRows = await dataSource.query<Array<{
      id: string;
      person_id: string;
      expires_at: Date;
      last_active_at: Date;
      revoked_at: Date | null;
      full_name: string | null;
      email_address: string | null;
      person_found: boolean;
      is_admin: boolean;
    }>>(
      `
        SELECT
          session.id,
          session.person_id,
          session.expires_at,
          session.last_active_at,
          session.revoked_at,
          p.full_name,
          p.email_address,
          (p.id IS NOT NULL) AS person_found,
          EXISTS (
            SELECT 1
            FROM membership m
            JOIN groups g ON g.id = m.group_id
            WHERE m.person_id = session.person_id AND g.group_type = 'admin'
          ) AS is_admin
        FROM (
          SELECT id, person_id, expires_at, last_active_at, revoked_at
          FROM auth_session
          WHERE session_token_hash = $1
          ORDER BY created_at DESC
          LIMIT 1
        ) session
        LEFT JOIN person p ON p.id = session.person_id;
      `,
      [hashSessionToken(token)],
    );

    const currentSession = sessionRows[0];
    if (!currentSession) {
      return success({ authenticated: false });
    }

    const valid = isSessionValid({
      revokedAt: currentSession.revoked_at,
      expiresAt: currentSession.expires_at,
      lastActiveAt: currentSession.last_active_at,
    });
    if (!valid) {
      await dataSource.query(`DELETE FROM auth_session WHERE id = $1;`, [currentSession.id]);
      return success({ authenticated: false });
    }

    if (!currentSession.person_found) {
      return success({ authenticated: false });
    }

    if (shouldRefreshSessionActivity(currentSession.last_active_at)) {
      await dataSource.query(
        `UPDATE auth_session SET last_active_at = NOW() WHERE id = $1;`,
        [currentSession.id],
      );
    }

    return success({
      authenticated: true,
      person: {
        id: currentSession.person_id,
        fullName: currentSession.full_name,
        emailAddress: currentSession.email_address,
        isAdmin: Boolean(currentSession.is_admin),
        candidateId: null,
      },
    });
  } catch (error) {
    console.error("[/api/auth/session] failed", error);
    return internalError();
  }
}
