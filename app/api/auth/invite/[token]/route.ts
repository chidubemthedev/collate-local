import "server-only";
import { connection } from "next/server";
import { getDataSource } from "@/lib/db";
import { SESSION_LIFETIME_MS } from "@/lib/auth/config";
import { setSessionCookie } from "@/lib/auth/cookie";
import { consumeFixedWindowRateLimit, ipBucketKey } from "@/lib/auth/rate-limit";
import { assertSameOrigin, getClientIp } from "@/lib/auth/request";
import { createSessionToken, hashSessionToken } from "@/lib/auth/session";
import { failure, internalError, success } from "@/lib/api/response";
import { CANDIDATE_ROWS_SQL, type CandidateRow } from "@/lib/invites/candidates-sql";
import { toCandidateInviteItem } from "@/lib/invites/candidate-item";
import { hashInviteToken, isInviteTokenShape, LINK_STATE_MESSAGE, linkState } from "@/lib/invites/invites";
import { maskEmail } from "@/lib/settings/admins";
import type { InviteDetails } from "@/types/api";

type Params = { params: Promise<{ token: string }> };

type LinkRow = {
  id: string;
  candidate_id: number;
  email_address: string;
  expires_at: Date;
  is_revoked: boolean;
  accepted_at: Date | null;
};

const INVALID = "This invite link is not valid. Check you opened the whole link from the email.";
const EMAIL_TAKEN = "This email is now in use. Ask the admin for a new invite.";
const LIMIT_PER_IP = 30;
const LIMIT_WINDOW_MS = 15 * 60 * 1000;

/** Up to 30 invite requests per IP every 15 minutes. */
async function rateLimited(request: Request): Promise<boolean> {
  const windowStartedAt = new Date(Math.floor(Date.now() / LIMIT_WINDOW_MS) * LIMIT_WINDOW_MS);
  const check = await consumeFixedWindowRateLimit(
    ipBucketKey("invite-ip", getClientIp(request)),
    windowStartedAt,
    LIMIT_PER_IP,
  );
  return !check.allowed;
}

function isEmailTaken(error: unknown): boolean {
  const candidates = [error, (error as { driverError?: unknown } | null)?.driverError];
  return candidates.some((item) => {
    const pg = item as { code?: string; constraint?: string } | null;
    return pg?.code === "23505" && pg.constraint === "uq_person_email_address_lower";
  });
}

/** What the invite is for (name, office, seat), or why it can no longer be used. No sign-in needed. */
export async function GET(request: Request, { params }: Params) {
  await connection();
  const { token } = await params;
  if (!isInviteTokenShape(token)) return failure("not_found", INVALID);

  try {
    if (await rateLimited(request)) return failure("too_many_requests", "Too many requests");
    const dataSource = await getDataSource();
    const [link] = await dataSource.query<LinkRow[]>(
      `
        SELECT id, candidate_id, email_address, expires_at, is_revoked, accepted_at
        FROM invite_access_link WHERE token_hash = $1;
      `,
      [hashInviteToken(token)],
    );
    if (!link) return failure("not_found", INVALID);
    const state = linkState({ isRevoked: link.is_revoked, acceptedAt: link.accepted_at, expiresAt: link.expires_at });
    if (state !== "valid") return failure("conflict", LINK_STATE_MESSAGE[state]);

    const [row] = await dataSource.query<CandidateRow[]>(
      `SELECT * FROM (${CANDIDATE_ROWS_SQL}) candidates WHERE id = $1;`,
      [link.candidate_id],
    );
    if (!row) return failure("not_found", INVALID);
    if (row.person_email) return failure("conflict", LINK_STATE_MESSAGE.used);

    const item = toCandidateInviteItem(row);
    const details: InviteDetails = {
      fullName: item.fullName,
      title: item.title,
      seat: item.seat,
      email: maskEmail(link.email_address) ?? "",
      expiresAt: new Date(link.expires_at).toISOString(),
    };
    return success(details);
  } catch (error) {
    console.error("[/api/auth/invite/[token]] GET failed", error);
    return internalError();
  }
}

/**
 * Completes registration: saves the invite's email on the candidate, uses up the link and signs
 * them in. The email is checked again, as someone may have taken it since the invite was sent.
 */
export async function POST(request: Request, { params }: Params) {
  await connection();
  try {
    assertSameOrigin(request);
  } catch {
    return failure("invalid_origin", "Request origin is not allowed");
  }
  const { token } = await params;
  if (!isInviteTokenShape(token)) return failure("not_found", INVALID);

  try {
    if (await rateLimited(request)) return failure("too_many_requests", "Too many requests");
    const dataSource = await getDataSource();
    const ip = getClientIp(request);
    const sessionToken = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

    const outcome = await dataSource.transaction(async (manager) => {
      const [link] = (await manager.query(
        `
          SELECT id, candidate_id, email_address, expires_at, is_revoked, accepted_at
          FROM invite_access_link WHERE token_hash = $1
          FOR UPDATE;
        `,
        [hashInviteToken(token)],
      )) as LinkRow[];
      if (!link) return { error: failure("not_found", INVALID) };
      const state = linkState({ isRevoked: link.is_revoked, acceptedAt: link.accepted_at, expiresAt: link.expires_at });
      if (state !== "valid") return { error: failure("conflict", LINK_STATE_MESSAGE[state]) };

      const [person] = (await manager.query(
        `
          SELECT p.id, p.email_address FROM candidate c JOIN person p ON p.id = c.person_id
          WHERE c.id = $1
          FOR UPDATE OF p;
        `,
        [link.candidate_id],
      )) as Array<{ id: string; email_address: string | null }>;
      if (!person) return { error: failure("not_found", INVALID) };
      if (person.email_address) return { error: failure("conflict", LINK_STATE_MESSAGE.used) };

      const [taken] = (await manager.query(`SELECT 1 FROM person WHERE LOWER(email_address) = $1 LIMIT 1;`, [
        link.email_address.toLowerCase(),
      ])) as unknown[];
      if (taken) return { error: failure("conflict", EMAIL_TAKEN) };

      await manager.query(`UPDATE person SET email_address = $1 WHERE id = $2;`, [link.email_address, person.id]);
      await manager.query(`UPDATE invite_access_link SET accepted_at = NOW() WHERE id = $1;`, [link.id]);
      // Other invites waiting on this email can never complete now.
      await manager.query(
        `
          UPDATE invite_access_link SET is_revoked = TRUE
          WHERE LOWER(email_address) = $1 AND id <> $2 AND NOT is_revoked AND accepted_at IS NULL;
        `,
        [link.email_address.toLowerCase(), link.id],
      );
      await manager.query(
        `
          INSERT INTO auth_session (person_id, session_token_hash, expires_at, last_active_at, revoked_at, created_from_ip)
          VALUES ($1, $2, $3, NOW(), NULL, $4);
        `,
        [person.id, hashSessionToken(sessionToken), expiresAt, ip === "unknown" ? null : ip],
      );
      await manager.query(
        `
          INSERT INTO audit_log
            (actor_person_id, action_type, target_entity_type, target_entity_id, ip_address)
          VALUES ($1, 'invite.accepted', 'candidate', $2, $3);
        `,
        [person.id, String(link.candidate_id), ip],
      );
      return { ok: true as const };
    });

    if ("error" in outcome) return outcome.error;
    await setSessionCookie(sessionToken, expiresAt);
    return success({ ok: true });
  } catch (error) {
    if (isEmailTaken(error)) return failure("conflict", EMAIL_TAKEN);
    console.error("[/api/auth/invite/[token]] POST failed", error);
    return internalError();
  }
}
