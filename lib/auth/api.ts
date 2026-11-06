import "server-only";
import { cookies } from "next/headers";
import type { DataSource } from "typeorm";
import { getDataSource } from "@/lib/db";
import { getSessionCookieName } from "@/lib/auth/config";
import { hashSessionToken, isSessionValid, shouldRefreshSessionActivity } from "@/lib/auth/session";
import { failure } from "@/lib/api/response";
import type { MembershipScope } from "@/lib/auth/coverage-scope";

export { getCoverageScopeFilter } from "@/lib/auth/coverage-scope";

export type ApiAuthContext = {
  dataSource: DataSource;
  personId: string;
  isAdmin: boolean;
  canManageCoverage: boolean;
  hasGlobalCoverageAccess: boolean;
  roles: Array<{ name: string; type: string }>;
  scopes: MembershipScope[];
};

export type ApiAuthResult =
  | { ok: true; context: ApiAuthContext }
  | { ok: false; response: Response };

type SessionMembershipRow = {
  id: string;
  person_id: string;
  expires_at: Date;
  last_active_at: Date;
  revoked_at: Date | null;
  group_name: string | null;
  group_type: string | null;
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
        g.group_name,
        g.group_type,
        ms.scope_state_id,
        ms.scope_lga_id,
        ms.scope_ward_id,
        ms.scope_political_unit_id
      FROM (
        SELECT id, person_id, expires_at, last_active_at, revoked_at
        FROM auth_session
        WHERE session_token_hash = $1
        ORDER BY created_at DESC
        LIMIT 1
      ) session
      LEFT JOIN membership m ON m.person_id = session.person_id
      LEFT JOIN groups g ON g.id = m.group_id
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

  const membershipRows = rows.filter(
    (row): row is SessionMembershipRow & { group_name: string; group_type: string } =>
      row.group_type !== null,
  );
  if (membershipRows.length === 0) {
    return { ok: false, response: failure("forbidden", "Access is not permitted") };
  }

  if (shouldRefreshSessionActivity(session.last_active_at)) {
    await dataSource.query(`UPDATE auth_session SET last_active_at = NOW() WHERE id = $1;`, [session.id]);
  }

  return {
    ok: true,
    context: {
      dataSource,
      personId: session.person_id,
      isAdmin: membershipRows.some((row) => row.group_type === "admin"),
      canManageCoverage: membershipRows.some((row) =>
        ["admin", "party", "campaign"].includes(row.group_type),
      ),
      hasGlobalCoverageAccess: membershipRows.some(
        (row) => row.group_type === "admin" || row.group_type === "party",
      ),
      roles: membershipRows.map((row) => ({ name: row.group_name, type: row.group_type })),
      scopes: membershipRows
        .filter(
          (row) =>
            row.scope_state_id !== null ||
            row.scope_lga_id !== null ||
            row.scope_ward_id !== null ||
            row.scope_political_unit_id !== null,
        )
        .map((row) => ({
          stateId: row.scope_state_id,
          lgaId: row.scope_lga_id,
          wardId: row.scope_ward_id,
          politicalUnitId: row.scope_political_unit_id,
        })),
    },
  };
}
