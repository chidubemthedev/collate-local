import "server-only";
import { connection } from "next/server";
import { requireApiAuth } from "@/lib/auth/api";
import { failure, internalError, success } from "@/lib/api/response";
import {
  AUDIT_KINDS,
  AUDIT_PAGE_SIZE,
  AUDIT_PAGE_SIZE_MAX,
  auditActionLabel,
  decodeAuditCursor,
  encodeAuditCursor,
  parseAuditDate,
  type AuditKind,
} from "@/lib/audit/audit-log";
import type { AuditLogItem } from "@/types/api";

type AuditRow = {
  id: string;
  at: string;
  action_type: string;
  actor_person_id: string | null;
  actor_name: string | null;
  target_entity_type: string | null;
  target_entity_id: string | null;
  target_name: string | null;
  ip_address: string | null;
};

/** Days are Nigerian days: "to 7 Nov" means up to midnight in Lagos. */
const TIME_ZONE = "Africa/Lagos";

/**
 * Settings · Audit log: who did what, newest first. Admins only.
 * Query: kind (changes | views | all, default changes), q (who: name or email), from and to
 * (YYYY-MM-DD, Lagos days, inclusive), limit, cursor. total is worked out on the first page only.
 */
export async function GET(request: Request) {
  await connection();

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;
    if (!auth.context.isAdmin) return failure("forbidden", "Only admins can see the audit log");

    const params = new URL(request.url).searchParams;
    const kind = (params.get("kind") || "changes") as AuditKind;
    if (!AUDIT_KINDS.includes(kind)) return failure("validation_failed", "Invalid kind", { kind: "unknown_kind" });
    const q = (params.get("q") ?? "").trim();
    if (q.length > 100) return failure("validation_failed", "Invalid search", { q: "must_be_at_most_100" });
    const from = parseAuditDate(params.get("from"));
    const to = parseAuditDate(params.get("to"));
    if ((params.get("from") && !from) || (params.get("to") && !to)) {
      return failure("validation_failed", "Invalid date", { [params.get("from") && !from ? "from" : "to"]: "use_yyyy_mm_dd" });
    }
    if (from && to && from > to) return failure("validation_failed", "From is after To", { from: "after_to" });
    const limitParam = params.get("limit");
    const limit = limitParam === null ? AUDIT_PAGE_SIZE : Number(limitParam);
    if (!Number.isInteger(limit) || limit < 1 || limit > AUDIT_PAGE_SIZE_MAX) {
      return failure("validation_failed", "Invalid limit", { limit: `must_be_1_to_${AUDIT_PAGE_SIZE_MAX}` });
    }
    const cursorParam = params.get("cursor");
    const cursor = cursorParam ? decodeAuditCursor(cursorParam) : null;
    if (cursorParam && !cursor) return failure("validation_failed", "Invalid cursor", { cursor: "invalid" });

    // Search is a plain "contains", so % and _ typed by the user are matched literally.
    const pattern = q ? `%${q.replace(/[\\%_]/g, (character) => `\\${character}`)}%` : null;
    const filters = `
      ($1::text = 'all' OR ($1 = 'views') = (a.action_type LIKE 'view\\_%'))
      AND ($2::text IS NULL OR EXISTS (
        SELECT 1 FROM person who
        WHERE who.id = a.actor_person_id AND (who.full_name ILIKE $2 OR who.email_address ILIKE $2)
      ))
      AND ($3::date IS NULL OR a.created_at >= ($3::date)::timestamp AT TIME ZONE '${TIME_ZONE}')
      AND ($4::date IS NULL OR a.created_at < ($4::date + 1)::timestamp AT TIME ZONE '${TIME_ZONE}')
    `;
    const filterParams = [kind, pattern, from, to];

    // The page first (by the created_at index), then names for just those rows.
    const rowsQuery = auth.context.dataSource.query<AuditRow[]>(
      `
        WITH page AS (
          SELECT a.id, a.created_at, a.action_type, a.actor_person_id, a.target_entity_type, a.target_entity_id, a.ip_address
          FROM audit_log a
          WHERE ${filters}
            AND ($5::timestamptz IS NULL OR (a.created_at, a.id) < ($5::timestamptz, $6::bigint))
          ORDER BY a.created_at DESC, a.id DESC
          LIMIT $7
        )
        SELECT
          page.id::text AS id,
          to_char(page.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at,
          page.action_type,
          page.actor_person_id,
          actor.full_name AS actor_name,
          page.target_entity_type,
          page.target_entity_id,
          CASE page.target_entity_type
            WHEN 'person' THEN (SELECT p.full_name FROM person p WHERE p.id::text = page.target_entity_id)
            WHEN 'candidate' THEN (
              SELECT p.full_name FROM candidate c JOIN person p ON p.id = c.person_id
              WHERE c.id::text = page.target_entity_id
            )
            WHEN 'group_type' THEN (SELECT t.type_name FROM group_type t WHERE t.id::text = page.target_entity_id)
            WHEN 'ward' THEN (SELECT w.ward_name FROM ward w WHERE w.id::text = page.target_entity_id)
          END AS target_name,
          page.ip_address
        FROM page
        LEFT JOIN person actor ON actor.id = page.actor_person_id
        ORDER BY page.created_at DESC, page.id DESC;
      `,
      [...filterParams, cursor?.at ?? null, cursor?.id ?? null, limit + 1],
    );
    const countQuery = cursor
      ? Promise.resolve(null)
      : auth.context.dataSource.query<Array<{ total: number }>>(
          `SELECT COUNT(*)::int AS total FROM audit_log a WHERE ${filters};`,
          filterParams,
        );
    const [rows, count] = await Promise.all([rowsQuery, countQuery]);

    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor = rows.length > limit && last ? encodeAuditCursor({ at: last.at, id: last.id }) : null;

    const items: AuditLogItem[] = page.map((row) => ({
      id: row.id,
      at: row.at,
      action: row.action_type,
      actionLabel: auditActionLabel(row.action_type),
      isView: row.action_type.startsWith("view_"),
      actor: row.actor_person_id ? { personId: row.actor_person_id, name: row.actor_name } : null,
      target: row.target_entity_type
        ? { type: row.target_entity_type, id: row.target_entity_id, name: row.target_name }
        : null,
      ipAddress: row.ip_address,
    }));
    return success(items, { nextCursor, limit, ...(count ? { total: Number(count[0]?.total ?? 0) } : {}) });
  } catch (error) {
    console.error("[/api/settings/audit-log] GET failed", error);
    return internalError();
  }
}
