import "server-only";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { getDataSource } from "@/lib/db";
import { getSessionCookieName } from "@/lib/auth/config";
import { hashSessionToken, isSessionValid } from "@/lib/auth/session";

export async function GET() {
  await connection();

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getSessionCookieName())?.value;
    if (!token) {
      return Response.json({ authenticated: false });
    }

    const dataSource = await getDataSource();
    const sessionRows = await dataSource.query<Array<{
      id: string;
      person_id: string;
      expires_at: Date;
      last_active_at: Date;
      revoked_at: Date | null;
    }>>(
      `
        SELECT id, person_id, expires_at, last_active_at, revoked_at
        FROM auth_session
        WHERE session_token_hash = $1
        ORDER BY created_at DESC
        LIMIT 1;
      `,
      [hashSessionToken(token)],
    );

    const currentSession = sessionRows[0];
    if (!currentSession) {
      return Response.json({ authenticated: false });
    }

    const valid = isSessionValid({
      revokedAt: currentSession.revoked_at,
      expiresAt: currentSession.expires_at,
      lastActiveAt: currentSession.last_active_at,
    });
    if (!valid) {
      await dataSource.query(`DELETE FROM auth_session WHERE id = $1;`, [currentSession.id]);
      return Response.json({ authenticated: false });
    }

    const personRows = await dataSource.query<Array<{ id: string; full_name: string; email_address: string | null }>>(
      `SELECT id, full_name, email_address FROM person WHERE id = $1 LIMIT 1;`,
      [currentSession.person_id],
    );

    const person = personRows[0];
    if (!person) {
      return Response.json({ authenticated: false });
    }

    await dataSource.query(
      `UPDATE auth_session SET last_active_at = NOW() WHERE id = $1;`,
      [currentSession.id],
    );

    const membershipRows = await dataSource.query<Array<{ is_admin: boolean }>>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM membership m
          JOIN groups g ON g.id = m.group_id
          WHERE m.person_id = $1 AND g.group_type = 'admin'
        ) AS is_admin;
      `,
      [person.id],
    );

    return Response.json({
      authenticated: true,
      person: {
        id: person.id,
        fullName: person.full_name,
        emailAddress: person.email_address,
        isAdmin: Boolean(membershipRows[0]?.is_admin),
        candidateId: null,
      },
    });
  } catch (error) {
    console.error("[/api/auth/session] failed", error);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
