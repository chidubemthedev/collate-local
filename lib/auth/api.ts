import "server-only";
import { cookies } from "next/headers";
import type { DataSource } from "typeorm";
import { getDataSource } from "@/lib/db";
import { getSessionCookieName } from "@/lib/auth/config";
import { hashSessionToken, isSessionValid } from "@/lib/auth/session";

type MembershipScope = {
  stateId: number | null;
  lgaId: number | null;
  wardId: number | null;
  politicalUnitId: number | null;
};

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

export async function requireApiAuth(): Promise<ApiAuthResult> {
  const token = (await cookies()).get(getSessionCookieName())?.value;
  if (!token) {
    return { ok: false, response: Response.json({ error: "unauthenticated" }, { status: 401 }) };
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

  const session = sessionRows[0];
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
    return { ok: false, response: Response.json({ error: "unauthenticated" }, { status: 401 }) };
  }

  const membershipRows = await dataSource.query<Array<{
    group_name: string;
    group_type: string;
    scope_state_id: number | null;
    scope_lga_id: number | null;
    scope_ward_id: number | null;
    scope_political_unit_id: number | null;
  }>>(
    `
      SELECT
        g.group_name,
        g.group_type,
        ms.scope_state_id,
        ms.scope_lga_id,
        ms.scope_ward_id,
        ms.scope_political_unit_id
      FROM membership m
      JOIN groups g ON g.id = m.group_id
      LEFT JOIN membership_scope_unit ms ON ms.membership_id = m.id
      WHERE m.person_id = $1;
    `,
    [session.person_id],
  );

  if (membershipRows.length === 0) {
    return { ok: false, response: Response.json({ error: "forbidden" }, { status: 403 }) };
  }

  await dataSource.query(`UPDATE auth_session SET last_active_at = NOW() WHERE id = $1;`, [session.id]);

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

export function getCoverageScopeFilter(
  context: ApiAuthContext,
  aliases: { state: string; lga: string; ward: string; pollingUnit: string },
  firstParameter = 1,
): { sql: string; parameters: unknown[] } {
  const stateIds = [
    ...new Set(context.scopes.flatMap((scope) => scope.stateId === null ? [] : [scope.stateId])),
  ];
  const lgaIds = [
    ...new Set(context.scopes.flatMap((scope) => scope.lgaId === null ? [] : [scope.lgaId])),
  ];
  const wardIds = [
    ...new Set(context.scopes.flatMap((scope) => scope.wardId === null ? [] : [scope.wardId])),
  ];
  const politicalUnitIds = [
    ...new Set(
      context.scopes.flatMap((scope) =>
        scope.politicalUnitId === null ? [] : [scope.politicalUnitId],
      ),
    ),
  ];

  const globalParameter = firstParameter;
  const stateParameter = firstParameter + 1;
  const lgaParameter = firstParameter + 2;
  const wardParameter = firstParameter + 3;
  const politicalUnitParameter = firstParameter + 4;

  return {
    sql: `(
      $${globalParameter}::boolean
      OR ${aliases.state}.id = ANY($${stateParameter}::int[])
      OR ${aliases.lga}.id = ANY($${lgaParameter}::int[])
      OR ${aliases.ward}.id = ANY($${wardParameter}::int[])
      OR EXISTS (
        SELECT 1
        FROM pu_political_unit scope_ppu
        WHERE scope_ppu.polling_unit_id = ${aliases.pollingUnit}.id
          AND scope_ppu.political_unit_id = ANY($${politicalUnitParameter}::int[])
      )
    )`,
    parameters: [
      context.hasGlobalCoverageAccess,
      stateIds,
      lgaIds,
      wardIds,
      politicalUnitIds,
    ],
  };
}
