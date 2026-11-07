import "server-only";
import { connection } from "next/server";
import { requireApiAuth } from "@/lib/auth/api";
import { failure, internalError, success } from "@/lib/api/response";
import { CANDIDATE_ROWS_SQL, type CandidateRow } from "@/lib/invites/candidates-sql";
import { toCandidateInviteItem } from "@/lib/invites/candidate-item";
import {
  CANDIDATES_PAGE_SIZE,
  CANDIDATES_PAGE_SIZE_MAX,
  decodeCandidateCursor,
  encodeCandidateCursor,
} from "@/lib/invites/invites";

const OFFICES = ["President", "Governor", "Senate", "House of Reps", "State Assembly"];
const STATUSES = ["not_invited", "invited", "expired", "registered"];

/**
 * Settings · Candidates: every candidate and running mate with their invite status. Admins only.
 * Query: q (name or seat), office, status, limit, cursor.
 */
export async function GET(request: Request) {
  await connection();

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;
    if (!auth.context.isAdmin) return failure("forbidden", "Only admins can invite candidates");

    const params = new URL(request.url).searchParams;
    const q = (params.get("q") ?? "").trim();
    if (q.length > 100) return failure("validation_failed", "Invalid search", { q: "must_be_at_most_100" });
    const office = params.get("office") || null;
    if (office !== null && !OFFICES.includes(office)) {
      return failure("validation_failed", "Invalid office", { office: "unknown_office" });
    }
    const status = params.get("status") || null;
    if (status !== null && !STATUSES.includes(status)) {
      return failure("validation_failed", "Invalid status", { status: "unknown_status" });
    }
    const limitParam = params.get("limit");
    const limit = limitParam === null ? CANDIDATES_PAGE_SIZE : Number(limitParam);
    if (!Number.isInteger(limit) || limit < 1 || limit > CANDIDATES_PAGE_SIZE_MAX) {
      return failure("validation_failed", "Invalid limit", { limit: `must_be_1_to_${CANDIDATES_PAGE_SIZE_MAX}` });
    }
    const cursorParam = params.get("cursor");
    const cursor = cursorParam ? decodeCandidateCursor(cursorParam) : null;
    if (cursorParam && !cursor) return failure("validation_failed", "Invalid cursor", { cursor: "invalid" });

    // Search is a plain "contains", so % and _ typed by the user are matched literally.
    const pattern = q ? `%${q.replace(/[\\%_]/g, (character) => `\\${character}`)}%` : null;
    const filters = `
      ($1::text IS NULL OR full_name ILIKE $1 OR unit_name ILIKE $1 OR principal_name ILIKE $1)
      AND ($2::text IS NULL OR office_name = $2)
      AND ($3::text IS NULL OR status = $3)
    `;
    const rowsQuery = auth.context.dataSource.query<CandidateRow[]>(
      `
        SELECT * FROM (${CANDIDATE_ROWS_SQL}) candidates
        WHERE ${filters}
          AND ($4::int IS NULL OR (level, unit_sort, family, mate, id) > ($4::int, $5::text, $6::int, $7::int, $8::int))
        ORDER BY level, unit_sort, family, mate, id
        LIMIT $9;
      `,
      [
        pattern,
        office,
        status,
        cursor?.level ?? null,
        cursor?.unit ?? null,
        cursor?.family ?? null,
        cursor?.mate ?? null,
        cursor?.id ?? null,
        limit + 1,
      ],
    );
    // Every match, for "Showing 1–25 of N" and the page count.
    const countQuery = auth.context.dataSource.query<Array<{ total: number }>>(
      `SELECT COUNT(*)::int AS total FROM (${CANDIDATE_ROWS_SQL}) candidates WHERE ${filters};`,
      [pattern, office, status],
    );
    const [rows, [count]] = await Promise.all([rowsQuery, countQuery]);

    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor =
      rows.length > limit && last
        ? encodeCandidateCursor({
            level: Number(last.level),
            unit: last.unit_sort,
            family: Number(last.family),
            mate: Number(last.mate),
            id: Number(last.id),
          })
        : null;
    return success(page.map(toCandidateInviteItem), { nextCursor, limit, total: Number(count?.total ?? 0) });
  } catch (error) {
    console.error("[/api/settings/candidates] GET failed", error);
    return internalError();
  }
}
