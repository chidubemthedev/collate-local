import "server-only";
import { cookies } from "next/headers";
import type { DataSource } from "typeorm";
import { getDataSource } from "@/lib/db";
import { getSessionCookieName } from "@/lib/auth/config";
import { hashSessionToken, isSessionValid, shouldRefreshSessionActivity } from "@/lib/auth/session";
import { failure } from "@/lib/api/response";
import type { MembershipScope } from "@/lib/auth/coverage-scope";
import {
  candidateAccess,
  effectiveAccess,
  loadCandidateSeat,
  ownAccessFromRows,
  type OwnAccess,
} from "@/lib/auth/view-as";

export { getCoverageScopeFilter } from "@/lib/auth/coverage-scope";

export type ApiAuthContext = {
  dataSource: DataSource;
  personId: string;
  isAdmin: boolean;
  /** May open Coverage, Candidates and Agents (anyone in a group; what they see is limited by area). */
  canManageCoverage: boolean;
  /** May send broadcasts (their group type can message agents). */
  canMessage: boolean;
  hasGlobalCoverageAccess: boolean;
  roles: Array<{ name: string; type: string }>;
  scopes: MembershipScope[];
  sessionId: string;
  /** The person's own access and its label, whatever view is on. */
  own: OwnAccess;
  ownLabel: string;
  /** Set while "View as" is on: access above is the previewed access, and nothing may be changed. */
  viewAs: { label: string; seatId: number | null } | null;
};

/** Every change is refused while a person is previewing someone else's access. */
export function readOnlyResponse(): Response {
  return failure("forbidden", "Viewing as someone else is read-only. Exit the view to make changes.");
}

export type ApiAuthResult =
  | { ok: true; context: ApiAuthContext }
  | { ok: false; response: Response };

type SessionMembershipRow = {
  id: string;
  person_id: string;
  expires_at: Date;
  last_active_at: Date;
  revoked_at: Date | null;
  view_as: unknown;
  group_name: string | null;
  group_type: string | null;
  can_message: string | null;
  sees_coverage: string | null;
  scope_state_id: number | null;
  scope_lga_id: number | null;
  scope_ward_id: number | null;
  scope_political_unit_id: number | null;
};

export async function requireApiAuth(): Promise<ApiAuthResult> {
  const token = (await cookies()).get(getSessionCookieName())?.value;
  if (!token) {
    return { ok: false, response: failure("unauthorized", "Authentication is required") };
  }

  const dataSource = await getDataSource();
  // The session and the person's groups and scopes in one round trip (this runs on every call).
  const rows = await dataSource.query<SessionMembershipRow[]>(
    `
      SELECT
        session.id,
        session.person_id,
        session.expires_at,
        session.last_active_at,
        session.revoked_at,
        session.view_as,
        g.group_name,
        gt.type_key AS group_type,
        gt.can_message,
        gt.sees_coverage,
        ms.scope_state_id,
        ms.scope_lga_id,
        ms.scope_ward_id,
        ms.scope_political_unit_id
      FROM (
        SELECT id, person_id, expires_at, last_active_at, revoked_at, view_as
        FROM auth_session
        WHERE session_token_hash = $1
        ORDER BY created_at DESC
        LIMIT 1
      ) session
      LEFT JOIN membership m ON m.person_id = session.person_id
      LEFT JOIN groups g ON g.id = m.group_id
      LEFT JOIN group_type gt ON gt.id = g.group_type_id
      LEFT JOIN membership_scope_unit ms ON ms.membership_id = m.id;
    `,
    [hashSessionToken(token)],
  );

  const session = rows[0];
  if (
    !session ||
    !isSessionValid({
      revokedAt: session.revoked_at,
      expiresAt: session.expires_at,
      lastActiveAt: session.last_active_at,
    })
  ) {
    if (session) {
      await dataSource.query(`DELETE FROM auth_session WHERE id = $1;`, [session.id]);
    }
    return { ok: false, response: failure("unauthorized", "Authentication is required") };
  }

  // A type an admin created has no key, so membership is detected by the group itself.
  const membershipRows = rows.filter(
    (row): row is SessionMembershipRow & { group_name: string } => row.group_name !== null,
  );
  // No group: a candidate (or running mate) sees their seat's area. Anyone else is refused.
  const candidateSeat = membershipRows.length === 0 ? await loadCandidateSeat(dataSource, session.person_id) : null;
  if (membershipRows.length === 0 && !candidateSeat) {
    return { ok: false, response: failure("forbidden", "Access is not permitted") };
  }

  if (shouldRefreshSessionActivity(session.last_active_at)) {
    await dataSource.query(`UPDATE auth_session SET last_active_at = NOW() WHERE id = $1;`, [session.id]);
  }

  const { own, label: ownLabel, canMessage } = candidateSeat
    ? // Candidates message the agents in their seat; the agent and broadcast rules check the rest.
      { ...candidateAccess(candidateSeat), canMessage: true }
    : ownAccessFromRows(membershipRows);
  const base = {
    dataSource,
    personId: session.person_id,
    sessionId: session.id,
    own,
    ownLabel,
    // Every group type may look at its area; messaging depends on the type's rules.
    canManageCoverage: true,
  };

  if (session.view_as) {
    const view = await effectiveAccess(dataSource, own, session.view_as);
    if (view) {
      return {
        ok: true,
        context: {
          ...base,
          isAdmin: false,
          // Party and candidate views can message (the preview itself is read-only).
          canMessage: true,
          hasGlobalCoverageAccess: view.hasGlobalCoverageAccess,
          roles: [{ name: view.label, type: "view_as" }],
          scopes: view.scopes,
          viewAs: { label: view.label, seatId: view.seatId },
        },
      };
    }
    // The person's own access no longer covers the view, so it ends.
    await dataSource.query(`UPDATE auth_session SET view_as = NULL WHERE id = $1;`, [session.id]);
  }

  return {
    ok: true,
    context: {
      ...base,
      isAdmin: own.isAdmin,
      canMessage,
      hasGlobalCoverageAccess: own.hasGlobalCoverageAccess,
      roles: candidateSeat
        ? [{ name: ownLabel, type: "candidate" }]
        : membershipRows.map((row) => ({ name: row.group_name, type: row.group_type ?? "custom" })),
      scopes: own.scopes,
      viewAs: null,
    },
  };
}
