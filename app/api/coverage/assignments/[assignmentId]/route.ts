import "server-only";
import { connection } from "next/server";
import { getCoverageScopeFilter, readOnlyResponse, requireApiAuth } from "@/lib/auth/api";
import { getClientIp } from "@/lib/auth/request";
import { failure, internalError, success } from "@/lib/api/response";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  await connection();

  const origin = request.headers.get("origin");
  if (!origin || new URL(request.url).origin !== origin) {
    return failure("invalid_origin", "Request origin is not allowed");
  }

  const { assignmentId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assignmentId)) {
    return failure("validation_failed", "Invalid assignment ID");
  }

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;
    if (auth.context.viewAs) return readOnlyResponse();

    const scope = getCoverageScopeFilter(auth.context, {
      state: "s",
      lga: "l",
      ward: "w",
      pollingUnit: "pu",
    });

    const deleted = await auth.context.dataSource.transaction(async (manager) => {
      const assignments = (await manager.query<Array<{ id: string }>>(
        `
          SELECT aa.id
          FROM agent_assignment aa
          JOIN polling_unit pu ON pu.id = aa.polling_unit_id
          JOIN ward w ON w.id = pu.ward_id
          JOIN lga l ON l.id = w.lga_id
          JOIN state s ON s.id = l.state_id
          WHERE aa.id = $6
            AND ${scope.sql}
            AND (
              $8::boolean
              OR (
                aa.owner_group_id IS NOT NULL
                AND EXISTS (
                  SELECT 1
                  FROM membership m
                  JOIN groups g ON g.id = m.group_id
                  WHERE m.person_id = $7
                    AND m.group_id = aa.owner_group_id
                    AND g.group_type IN ('party', 'campaign')
                )
              )
              OR (
                aa.owner_candidate_id IS NOT NULL
                AND EXISTS (
                  SELECT 1
                  FROM candidate c
                  WHERE c.id = aa.owner_candidate_id AND c.person_id = $7
                )
              )
            )
          FOR UPDATE OF aa;
        `,
        [
          ...scope.parameters,
          assignmentId,
          auth.context.personId,
          auth.context.isAdmin,
        ],
      )) as Array<{ id: string }>;
      if (!assignments[0]) return false;

      await manager.query(`DELETE FROM agent_assignment WHERE id = $1;`, [assignmentId]);
      await manager.query(
        `
          INSERT INTO audit_log
            (actor_person_id, action_type, target_entity_type, target_entity_id, ip_address)
          VALUES ($1, 'coverage.assignment.deleted', 'agent_assignment', $2, $3);
        `,
        [auth.context.personId, assignmentId, getClientIp(request)],
      );
      return true;
    });

    if (!deleted) return failure("not_found", "Assignment not found");
    return success({ ok: true });
  } catch (error) {
    console.error("[/api/coverage/assignments/[assignmentId]] failed", error);
    return internalError();
  }
}
