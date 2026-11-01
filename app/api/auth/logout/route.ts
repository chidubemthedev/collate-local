import "server-only";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { getDataSource } from "@/lib/db";
import { getSessionCookieName } from "@/lib/auth/config";
import { hashSessionToken } from "@/lib/auth/session";
import { clearSessionCookie } from "@/lib/auth/cookie";
import { failure, success } from "@/lib/api/response";

export async function POST() {
  await connection();

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getSessionCookieName())?.value;

    if (token) {
      const dataSource = await getDataSource();
      await dataSource.query(`DELETE FROM auth_session WHERE session_token_hash = $1;`, [hashSessionToken(token)]);
    }

    await clearSessionCookie();
    return success({ ok: true });
  } catch (error) {
    console.error("[/api/auth/logout] failed", error);
    return failure("internal_error", "An unexpected error occurred");
  }
}
