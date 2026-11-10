import "server-only";
import { connection } from "next/server";
import { requireApiAuth } from "@/lib/auth/api";
import { failure, internalError, success } from "@/lib/api/response";
import { maskPhoneNumber } from "@/lib/policy";
import {
  AVAILABLE_AGENTS_PAGE_SIZE,
  AVAILABLE_AGENTS_PAGE_SIZE_MAX,
  AVAILABLE_AGENTS_QUERY_MAX,
  AVAILABLE_PERSON_SQL,
  containsPattern,
} from "@/lib/agents/available";
import { decodeAdminCursor as decodeNameCursor, encodeAdminCursor as encodeNameCursor } from "@/lib/settings/admins";
import type { AvailableAgentItem } from "@/types/api";

type AvailableRow = {
  id: string;
  full_name: string;
  sort_name: string;
  phone: string | null;
  telegram_linked: boolean;
  is_candidate: boolean;
};

function toItem(row: AvailableRow): AvailableAgentItem {
  return {
    personId: row.id,
    fullName: row.full_name,
    phone: maskPhoneNumber(row.phone),
    telegramLinked: row.telegram_linked,
    isCandidate: row.is_candidate,
  };
}

/**
 * People who can be assigned as an agent: everyone who is not already an agent and not an admin.
 * Query: q (part of the name), limit, cursor. Ordered by name. Any signed-in user; phones are masked,
 * and search covers names only so a phone number can't be used to find someone.
 */
export async function GET(request: Request) {
  await connection();

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;

    const params = new URL(request.url).searchParams;
    const q = (params.get("q") ?? "").trim().replace(/\s+/g, " ");
    if (q.length > AVAILABLE_AGENTS_QUERY_MAX) {
      return failure("validation_failed", "Invalid search", { q: `must_be_at_most_${AVAILABLE_AGENTS_QUERY_MAX}` });
    }

    const limitParam = params.get("limit");
    const limit = limitParam === null ? AVAILABLE_AGENTS_PAGE_SIZE : Number(limitParam);
    if (!Number.isInteger(limit) || limit < 1 || limit > AVAILABLE_AGENTS_PAGE_SIZE_MAX) {
      return failure("validation_failed", "Invalid limit", { limit: `must_be_1_to_${AVAILABLE_AGENTS_PAGE_SIZE_MAX}` });
    }

    const cursorParam = params.get("cursor");
    const cursor = cursorParam ? decodeNameCursor(cursorParam) : null;
    if (cursorParam && !cursor) return failure("validation_failed", "Invalid cursor", { cursor: "invalid" });

    const pattern = containsPattern(q);
    const rowsQuery = auth.context.dataSource.query<AvailableRow[]>(
      `
        SELECT p.id, p.full_name, LOWER(p.full_name) AS sort_name,
          (
            SELECT ph.e164_number FROM phone_number ph
            WHERE ph.person_id = p.id
            ORDER BY ph.created_at
            LIMIT 1
          ) AS phone,
          EXISTS (
            SELECT 1 FROM phone_number ph WHERE ph.person_id = p.id AND ph.telegram_chat_id IS NOT NULL
          ) AS telegram_linked,
          EXISTS (SELECT 1 FROM candidate c WHERE c.person_id = p.id) AS is_candidate
        FROM person p
        WHERE ${AVAILABLE_PERSON_SQL}
          AND ($1::text IS NULL OR p.full_name ILIKE $1)
          AND ($2::text IS NULL OR (LOWER(p.full_name), p.id) > ($2::text, $3::uuid))
        ORDER BY LOWER(p.full_name), p.id
        LIMIT $4;
      `,
      [pattern, cursor?.name ?? null, cursor?.id ?? null, limit + 1],
    );
    // Every match, on the first page only: "20 of 312 — keep typing to narrow".
    const countQuery = cursor
      ? Promise.resolve(null)
      : auth.context.dataSource.query<Array<{ total: number }>>(
          `
            SELECT COUNT(*)::int AS total
            FROM person p
            WHERE ${AVAILABLE_PERSON_SQL}
              AND ($1::text IS NULL OR p.full_name ILIKE $1);
          `,
          [pattern],
        );
    const [rows, count] = await Promise.all([rowsQuery, countQuery]);

    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor = rows.length > limit && last ? encodeNameCursor({ name: last.sort_name, id: last.id }) : null;
    return success(page.map(toItem), {
      nextCursor,
      limit,
      ...(count ? { total: Number(count[0]?.total ?? 0) } : {}),
    });
  } catch (error) {
    console.error("[/api/agents/available] GET failed", error);
    return internalError();
  }
}
