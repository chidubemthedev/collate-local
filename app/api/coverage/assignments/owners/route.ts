import "server-only";
import { connection } from "next/server";
import { requireApiAuth } from "@/lib/auth/api";
import { internalError, success } from "@/lib/api/response";
import { assignableCandidateSql, assignableGroupSql } from "@/lib/coverage/assignment-owners";
import type { AssignmentOwners } from "@/types/api";

/**
 * Owners the signed-in person can assign an agent for: groups (by name) and their own candidate
 * record. Feeds the Owner dropdown in the Assign popup; POST /api/coverage/assignments applies the
 * same rule. When viewing as someone else this still answers for the real person, but assigning
 * is blocked while viewing as anyway.
 */
export async function GET() {
  await connection();

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;
    const { dataSource, personId, isAdmin } = auth.context;

    const [groups, candidates] = await Promise.all([
      dataSource.query<Array<{ id: number | string; group_name: string; type_name: string }>>(
        `
          SELECT owner_group.id, owner_group.group_name, owner_type.type_name
          FROM groups owner_group
          JOIN group_type owner_type ON owner_type.id = owner_group.group_type_id
          WHERE ${assignableGroupSql("$1", "$2")}
          ORDER BY LOWER(owner_group.group_name), owner_group.id;
        `,
        [personId, isAdmin],
      ),
      dataSource.query<Array<{ id: number | string; full_name: string; office_name: string | null }>>(
        `
          SELECT c.id, p.full_name, o.office_name
          FROM candidate c
          JOIN person p ON p.id = c.person_id
          LEFT JOIN seat s ON s.id = c.seat_id
          LEFT JOIN office o ON o.id = s.office_id
          WHERE ${assignableCandidateSql("$1")}
          ORDER BY c.id;
        `,
        [personId],
      ),
    ]);

    const owners: AssignmentOwners = {
      groups: groups.map((row) => ({ id: Number(row.id), name: row.group_name, type: row.type_name })),
      candidates: candidates.map((row) => ({ id: Number(row.id), name: row.full_name, office: row.office_name })),
    };
    return success(owners);
  } catch (error) {
    console.error("[/api/coverage/assignments/owners] GET failed", error);
    return internalError();
  }
}
