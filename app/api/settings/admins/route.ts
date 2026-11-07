import "server-only";
import { connection } from "next/server";
import { readOnlyResponse, requireApiAuth } from "@/lib/auth/api";
import { assertSameOrigin, getClientIp } from "@/lib/auth/request";
import { failure, internalError, success } from "@/lib/api/response";
import { maskPhoneNumber } from "@/lib/policy";
import {
  ADMINS_PAGE_SIZE,
  ADMINS_PAGE_SIZE_MAX,
  decodeAdminCursor,
  encodeAdminCursor,
  maskEmail,
  parseNewAdmin,
} from "@/lib/settings/admins";
import type { AdminListItem } from "@/types/api";

type AdminRow = {
  id: string;
  full_name: string;
  sort_name: string;
  email_address: string | null;
  phone: string | null;
  group_names: string[];
};

function toItem(row: AdminRow, viewerId: string): AdminListItem {
  return {
    personId: row.id,
    fullName: row.full_name,
    email: maskEmail(row.email_address),
    phone: maskPhoneNumber(row.phone),
    groups: row.group_names,
    isYou: row.id === viewerId,
  };
}

/** Members of every group whose type is Admin, one row per person. */
const ADMINS_SQL = `
  SELECT p.id, p.full_name, LOWER(p.full_name) AS sort_name, p.email_address,
    (
      SELECT ph.e164_number FROM phone_number ph
      WHERE ph.person_id = p.id
      ORDER BY ph.created_at
      LIMIT 1
    ) AS phone,
    ARRAY_AGG(DISTINCT g.group_name ORDER BY g.group_name) AS group_names
  FROM person p
  JOIN membership m ON m.person_id = p.id
  JOIN groups g ON g.id = m.group_id
  JOIN group_type gt ON gt.id = g.group_type_id
  WHERE gt.type_key = 'admin'
`;

const FORBIDDEN = "Only admins can manage admins";

/** A unique-email violation on person (TypeORM keeps the pg fields, and the original as driverError). */
function isEmailTaken(error: unknown): boolean {
  const candidates = [error, (error as { driverError?: unknown } | null)?.driverError];
  return candidates.some((item) => {
    const pg = item as { code?: string; constraint?: string } | null;
    return pg?.code === "23505" && pg.constraint === "uq_person_email_address_lower";
  });
}

/** Settings · Admins: everyone who is an admin. Query: q (name or email), limit, cursor. Admins only. */
export async function GET(request: Request) {
  await connection();

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;
    if (!auth.context.isAdmin) return failure("forbidden", FORBIDDEN);

    const params = new URL(request.url).searchParams;
    const q = (params.get("q") ?? "").trim();
    if (q.length > 100) return failure("validation_failed", "Invalid search", { q: "must_be_at_most_100" });

    const limitParam = params.get("limit");
    const limit = limitParam === null ? ADMINS_PAGE_SIZE : Number(limitParam);
    if (!Number.isInteger(limit) || limit < 1 || limit > ADMINS_PAGE_SIZE_MAX) {
      return failure("validation_failed", "Invalid limit", { limit: `must_be_1_to_${ADMINS_PAGE_SIZE_MAX}` });
    }

    const cursorParam = params.get("cursor");
    const cursor = cursorParam ? decodeAdminCursor(cursorParam) : null;
    if (cursorParam && !cursor) return failure("validation_failed", "Invalid cursor", { cursor: "invalid" });

    // Search is a plain "contains", so % and _ typed by the user are matched literally.
    const pattern = q ? `%${q.replace(/[\\%_]/g, (character) => `\\${character}`)}%` : null;
    const rowsQuery = auth.context.dataSource.query<AdminRow[]>(
      `
        SELECT * FROM (
          ${ADMINS_SQL}
            AND ($1::text IS NULL OR p.full_name ILIKE $1 OR p.email_address ILIKE $1)
          GROUP BY p.id
        ) admins
        WHERE $2::text IS NULL OR (sort_name, id) > ($2::text, $3::uuid)
        ORDER BY sort_name, id
        LIMIT $4;
      `,
      [pattern, cursor?.name ?? null, cursor?.id ?? null, limit + 1],
    );
    // Every match, for "Showing 1–25 of N" and the page count.
    const countQuery = auth.context.dataSource.query<Array<{ total: number }>>(
      `
        SELECT COUNT(DISTINCT p.id)::int AS total
        FROM person p
        JOIN membership m ON m.person_id = p.id
        JOIN groups g ON g.id = m.group_id
        JOIN group_type gt ON gt.id = g.group_type_id
        WHERE gt.type_key = 'admin'
          AND ($1::text IS NULL OR p.full_name ILIKE $1 OR p.email_address ILIKE $1);
      `,
      [pattern],
    );
    const [rows, [count]] = await Promise.all([rowsQuery, countQuery]);

    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor = rows.length > limit && last ? encodeAdminCursor({ name: last.sort_name, id: last.id }) : null;
    return success(
      page.map((row) => toItem(row, auth.context.personId)),
      { nextCursor, limit, total: Number(count?.total ?? 0) },
    );
  } catch (error) {
    console.error("[/api/settings/admins] GET failed", error);
    return internalError();
  }
}

/** Adds an admin. Body: { fullName, email, phone? }. The email must not belong to anyone yet. */
export async function POST(request: Request) {
  await connection();
  try {
    assertSameOrigin(request);
  } catch {
    return failure("invalid_origin", "Request origin is not allowed");
  }

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;
    if (auth.context.viewAs) return readOnlyResponse();
    if (!auth.context.isAdmin) return failure("forbidden", FORBIDDEN);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure("validation_failed", "Invalid JSON request body");
    }
    const parsed = parseNewAdmin(body);
    if (!parsed.ok) return failure("validation_failed", "Check the admin's details", parsed.fields);
    const admin = parsed.value;

    const outcome = await auth.context.dataSource.transaction(async (manager) => {
      const [existing] = (await manager.query(
        `
          SELECT p.id, EXISTS (
            SELECT 1 FROM membership m
            JOIN groups g ON g.id = m.group_id
            JOIN group_type gt ON gt.id = g.group_type_id
            WHERE m.person_id = p.id AND gt.type_key = 'admin'
          ) AS is_admin
          FROM person p
          WHERE LOWER(p.email_address) = $1
          LIMIT 1;
        `,
        [admin.email],
      )) as Array<{ id: string; is_admin: boolean }>;
      if (existing) return existing.is_admin ? ("admin_exists" as const) : ("email_taken" as const);

      // New admins join the first admin group.
      const [group] = (await manager.query(
        `
          SELECT g.id FROM groups g
          JOIN group_type gt ON gt.id = g.group_type_id
          WHERE gt.type_key = 'admin'
          ORDER BY g.id
          LIMIT 1;
        `,
      )) as Array<{ id: number }>;
      if (!group) return "no_admin_group" as const;

      const [person] = (await manager.query(
        `INSERT INTO person (full_name, email_address) VALUES ($1, $2) RETURNING id, full_name, email_address;`,
        [admin.fullName, admin.email],
      )) as Array<{ id: string; full_name: string; email_address: string }>;
      await manager.query(
        `INSERT INTO membership (person_id, group_id, membership_role) VALUES ($1, $2, 'admin');`,
        [person.id, group.id],
      );
      if (admin.phone) {
        await manager.query(`INSERT INTO phone_number (person_id, e164_number) VALUES ($1, $2);`, [
          person.id,
          admin.phone,
        ]);
      }
      const [groupRow] = (await manager.query(`SELECT group_name FROM groups WHERE id = $1;`, [group.id])) as Array<{
        group_name: string;
      }>;
      await manager.query(
        `
          INSERT INTO audit_log
            (actor_person_id, action_type, target_entity_type, target_entity_id, ip_address)
          VALUES ($1, 'settings.admin.created', 'person', $2, $3);
        `,
        [auth.context.personId, person.id, getClientIp(request)],
      );
      return {
        id: person.id,
        full_name: person.full_name,
        sort_name: person.full_name.toLowerCase(),
        email_address: person.email_address,
        phone: admin.phone,
        group_names: [groupRow.group_name],
      } satisfies AdminRow;
    });

    if (outcome === "admin_exists") return failure("conflict", "This admin already exists");
    if (outcome === "email_taken") return failure("conflict", "This email already belongs to someone else");
    if (outcome === "no_admin_group") return failure("conflict", "There is no admin group to add them to");
    return success(toItem(outcome, auth.context.personId), undefined, 201);
  } catch (error) {
    // Two admins adding the same email at once: the unique email index catches the second.
    if (isEmailTaken(error)) {
      return failure("conflict", "This email already belongs to someone else");
    }
    console.error("[/api/settings/admins] POST failed", error);
    return internalError();
  }
}
