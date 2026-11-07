import "server-only";
import { connection } from "next/server";
import { readOnlyResponse, requireApiAuth } from "@/lib/auth/api";
import { assertSameOrigin, getClientIp } from "@/lib/auth/request";
import { failure, internalError, success } from "@/lib/api/response";
import { CANDIDATE_ROWS_SQL, type CandidateRow } from "@/lib/invites/candidates-sql";
import { toCandidateInviteItem } from "@/lib/invites/candidate-item";
import { sendInviteEmail } from "@/lib/invites/email";
import {
  createInviteToken,
  hashInviteToken,
  INVITE_TTL_MS,
  parseInviteEmail,
  publicBaseUrl,
} from "@/lib/invites/invites";
import { titleCaseName } from "@/lib/auth/view-as";

type Params = { params: Promise<{ candidateId: string }> };

function parseCandidateId(value: string): number | null {
  if (!/^[1-9][0-9]{0,9}$/.test(value)) return null;
  const id = Number(value);
  return id <= 2147483647 ? id : null;
}

/** The checks every change here starts with: same origin, a valid id, an admin, no "View as". */
async function begin(request: Request, params: Params["params"]) {
  try {
    assertSameOrigin(request);
  } catch {
    return { response: failure("invalid_origin", "Request origin is not allowed") } as const;
  }
  const candidateId = parseCandidateId((await params).candidateId);
  if (candidateId === null) return { response: failure("validation_failed", "Invalid candidate ID") } as const;
  const auth = await requireApiAuth();
  if (!auth.ok) return { response: auth.response } as const;
  if (auth.context.viewAs) return { response: readOnlyResponse() } as const;
  if (!auth.context.isAdmin) return { response: failure("forbidden", "Only admins can invite candidates") } as const;
  return { candidateId, context: auth.context } as const;
}

async function loadCandidate(query: (sql: string, parameters: unknown[]) => Promise<unknown>, candidateId: number) {
  const [row] = (await query(`SELECT * FROM (${CANDIDATE_ROWS_SQL}) candidates WHERE id = $1;`, [candidateId])) as CandidateRow[];
  return row ?? null;
}

/**
 * Invites a candidate (or sends a new invite, which cancels the old link). Body: { email }.
 * The email must not belong to anyone, nor be waiting on another candidate's invite.
 */
export async function POST(request: Request, { params }: Params) {
  await connection();
  try {
    const start = await begin(request, params);
    if ("response" in start) return start.response;
    const { candidateId, context } = start;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure("validation_failed", "Invalid JSON request body");
    }
    const parsed = parseInviteEmail(body);
    if (!parsed.ok) return failure("validation_failed", "Check the email", { email: parsed.message });
    const email = parsed.email;

    const token = createInviteToken();
    const outcome = await context.dataSource.transaction(async (manager) => {
      // One invite at a time per candidate: lock the candidate while their invites change.
      const [locked] = (await manager.query(
        `SELECT c.id, p.email_address FROM candidate c JOIN person p ON p.id = c.person_id WHERE c.id = $1 FOR UPDATE OF c;`,
        [candidateId],
      )) as Array<{ id: number; email_address: string | null }>;
      if (!locked) return "not_found" as const;
      if (locked.email_address) return "registered" as const;

      const [taken] = (await manager.query(`SELECT 1 FROM person WHERE LOWER(email_address) = $1 LIMIT 1;`, [
        email,
      ])) as unknown[];
      if (taken) return "email_taken" as const;
      const [pending] = (await manager.query(
        `
          SELECT 1 FROM invite_access_link
          WHERE LOWER(email_address) = $1 AND candidate_id <> $2
            AND NOT is_revoked AND accepted_at IS NULL AND expires_at > NOW()
          LIMIT 1;
        `,
        [email, candidateId],
      )) as unknown[];
      if (pending) return "email_pending" as const;

      await manager.query(
        `UPDATE invite_access_link SET is_revoked = TRUE WHERE candidate_id = $1 AND NOT is_revoked AND accepted_at IS NULL;`,
        [candidateId],
      );
      const [link] = (await manager.query(
        `
          INSERT INTO invite_access_link (candidate_id, email_address, token_hash, expires_at, invited_by_person_id)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id;
        `,
        [candidateId, email, hashInviteToken(token), new Date(Date.now() + INVITE_TTL_MS), context.personId],
      )) as Array<{ id: string }>;
      await manager.query(
        `
          INSERT INTO audit_log
            (actor_person_id, action_type, target_entity_type, target_entity_id, ip_address)
          VALUES ($1, 'settings.candidate.invited', 'candidate', $2, $3);
        `,
        [context.personId, String(candidateId), getClientIp(request)],
      );
      return { linkId: link.id };
    });

    if (outcome === "not_found") return failure("not_found", "Candidate not found");
    if (outcome === "registered") return failure("conflict", "This candidate has already registered");
    if (outcome === "email_taken") return failure("conflict", "This email already belongs to someone else");
    if (outcome === "email_pending") return failure("conflict", "This email already has a pending invite");

    const row = await loadCandidate((sql, parameters) => context.dataSource.query(sql, parameters), candidateId);
    if (!row) return failure("not_found", "Candidate not found");
    const title = row.principal_candidate_id === null ? row.office_name : toCandidateInviteItem(row).title;
    const seat = row.office_name === "President" ? title : `${title}, ${titleCaseName(row.unit_name)}`;
    try {
      await sendInviteEmail({
        to: email,
        name: titleCaseName(row.full_name),
        seat,
        link: `${publicBaseUrl(request.url)}/invite/${token}`,
      });
    } catch (error) {
      // An invite that never arrived must not block a new one: cancel it.
      console.error("[/api/settings/candidates/[candidateId]/invite] email failed", error);
      await context.dataSource.query(`UPDATE invite_access_link SET is_revoked = TRUE WHERE id = $1;`, [outcome.linkId]);
      return failure("internal_error", "The invite email could not be sent. Try again.");
    }

    return success(toCandidateInviteItem(row), undefined, 201);
  } catch (error) {
    console.error("[/api/settings/candidates/[candidateId]/invite] POST failed", error);
    return internalError();
  }
}

/** Cancels the candidate's invite: the link stops working. */
export async function DELETE(request: Request, { params }: Params) {
  await connection();
  try {
    const start = await begin(request, params);
    if ("response" in start) return start.response;
    const { candidateId, context } = start;

    const cancelled = await context.dataSource.transaction(async (manager) => {
      const rows = (await manager.query(
        `
          UPDATE invite_access_link SET is_revoked = TRUE
          WHERE candidate_id = $1 AND NOT is_revoked AND accepted_at IS NULL
          RETURNING id;
        `,
        [candidateId],
      )) as unknown[];
      // TypeORM's postgres driver returns [rows, count] for UPDATE ... RETURNING.
      const changed = Array.isArray(rows[0]) ? (rows[0] as unknown[]) : rows;
      if (!changed.length) return false;
      await manager.query(
        `
          INSERT INTO audit_log
            (actor_person_id, action_type, target_entity_type, target_entity_id, ip_address)
          VALUES ($1, 'settings.candidate.invite_cancelled', 'candidate', $2, $3);
        `,
        [context.personId, String(candidateId), getClientIp(request)],
      );
      return true;
    });

    if (!cancelled) return failure("not_found", "This candidate has no invite to cancel");
    return success({ ok: true });
  } catch (error) {
    console.error("[/api/settings/candidates/[candidateId]/invite] DELETE failed", error);
    return internalError();
  }
}
