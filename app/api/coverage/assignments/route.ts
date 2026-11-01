import "server-only";
import { connection } from "next/server";
import { getClientIp } from "@/lib/auth/request";
import { getCoverageScopeFilter, requireApiAuth } from "@/lib/auth/api";
import { failure, internalError, success } from "@/lib/api/response";

type AssignmentBody = {
  personId: string;
  pollingUnitId: number;
  ownerGroupId: number | null;
  ownerCandidateId: number | null;
  agentKind: "official" | "extra";
  slotNumber: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function parseOptionalOwnerId(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null;
  return isPositiveInteger(value) ? value : undefined;
}

function parseAssignmentBody(value: unknown): AssignmentBody | null {
  if (!isRecord(value)) return null;

  const { personId, pollingUnitId, agentKind, slotNumber } = value;
  const ownerGroupId = parseOptionalOwnerId(value.ownerGroupId);
  const ownerCandidateId = parseOptionalOwnerId(value.ownerCandidateId);
  if (
    typeof personId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(personId) ||
    !isPositiveInteger(pollingUnitId) ||
    ownerGroupId === undefined ||
    ownerCandidateId === undefined ||
    (ownerGroupId === null) === (ownerCandidateId === null) ||
    (agentKind !== "official" && agentKind !== "extra") ||
    typeof slotNumber !== "number" ||
    !Number.isSafeInteger(slotNumber) ||
    (agentKind === "official" && slotNumber !== 0) ||
    (agentKind === "extra" && slotNumber < 1)
  ) {
    return null;
  }

  return { personId, pollingUnitId, ownerGroupId, ownerCandidateId, agentKind, slotNumber };
}

function isPgError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

export async function POST(request: Request) {
  await connection();

  const origin = request.headers.get("origin");
  if (!origin || new URL(request.url).origin !== origin) {
    return failure("invalid_origin", "Request origin is not allowed");
  }

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return failure("validation_failed", "Invalid JSON request body");
    }

    const body = parseAssignmentBody(rawBody);
    if (!body) {
      return failure("validation_failed", "Invalid assignment");
    }

    const scope = getCoverageScopeFilter(auth.context, {
      state: "s",
      lga: "l",
      ward: "w",
      pollingUnit: "pu",
    });

    const result = await auth.context.dataSource.transaction(async (manager) => {
      const pollingUnits = (await manager.query<Array<{ id: number }>>(
        `SELECT id FROM polling_unit WHERE id = $1 FOR UPDATE;`,
        [body.pollingUnitId],
      )) as Array<{ id: number }>;
      if (!pollingUnits[0]) return { error: "not_found", status: 404 as const };

      const scopeRows = (await manager.query<Array<{ allowed: boolean }>>(
        `
          SELECT EXISTS (
            SELECT 1
            FROM polling_unit pu
            JOIN ward w ON w.id = pu.ward_id
            JOIN lga l ON l.id = w.lga_id
            JOIN state s ON s.id = l.state_id
            WHERE pu.id = $6 AND ${scope.sql}
          ) AS allowed;
        `,
        [...scope.parameters, body.pollingUnitId],
      )) as Array<{ allowed: boolean }>;
      if (!scopeRows[0]?.allowed) return { error: "not_found", status: 404 as const };

      const ownerRows = (await manager.query<Array<{ allowed: boolean }>>(
        `
          SELECT
            $4::boolean
            OR (
              $2::int IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM membership m
                JOIN groups g ON g.id = m.group_id
                WHERE m.person_id = $1
                  AND m.group_id = $2
                  AND g.group_type IN ('party', 'campaign')
              )
            )
            OR (
              $3::int IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM candidate c
                WHERE c.id = $3 AND c.person_id = $1
              )
            ) AS allowed;
        `,
        [
          auth.context.personId,
          body.ownerGroupId,
          body.ownerCandidateId,
          auth.context.isAdmin,
        ],
      )) as Array<{ allowed: boolean }>;
      if (!ownerRows[0]?.allowed) return { error: "forbidden", status: 403 as const };

      const conflicts = (await manager.query<Array<{ exists: boolean }>>(
        `
          SELECT EXISTS (
            SELECT 1
            FROM agent_assignment
            WHERE polling_unit_id = $1
              AND agent_kind = $2
              AND slot_number = $3
              AND owner_group_id IS NOT DISTINCT FROM $4
              AND owner_candidate_id IS NOT DISTINCT FROM $5
          ) AS exists;
        `,
        [
          body.pollingUnitId,
          body.agentKind,
          body.slotNumber,
          body.ownerGroupId,
          body.ownerCandidateId,
        ],
      )) as Array<{ exists: boolean }>;
      if (conflicts[0]?.exists) return { error: "assignment_conflict", status: 409 as const };

      const inserted = (await manager.query<Array<{ id: string }>>(
        `
          INSERT INTO agent_assignment
            (person_id, polling_unit_id, owner_group_id, owner_candidate_id, agent_kind, slot_number)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id;
        `,
        [
          body.personId,
          body.pollingUnitId,
          body.ownerGroupId,
          body.ownerCandidateId,
          body.agentKind,
          body.slotNumber,
        ],
      )) as Array<{ id: string }>;

      await manager.query(
        `
          INSERT INTO audit_log
            (actor_person_id, action_type, target_entity_type, target_entity_id, ip_address)
          VALUES ($1, 'coverage.assignment.created', 'agent_assignment', $2, $3);
        `,
        [auth.context.personId, inserted[0].id, getClientIp(request)],
      );

      return { id: inserted[0].id };
    });

    if ("error" in result) {
      if (result.error === "not_found") {
        return failure("not_found", "Polling unit not found");
      }
      if (result.error === "forbidden") {
        return failure("forbidden", "Assignment owner is not allowed");
      }
      return failure("conflict", "Assignment conflict");
    }

    return success({ ok: true, id: result.id }, undefined, 201);
  } catch (error) {
    if (isPgError(error, "23505")) {
      return failure("conflict", "Assignment conflict");
    }
    if (isPgError(error, "23503")) {
      return failure("not_found", "Assignment reference not found");
    }
    console.error("[/api/coverage/assignments] failed", error);
    return internalError();
  }
}
