import { connection } from "next/server";
import { internalError, success } from "@/lib/api/response";
import { getDataSource } from "@/lib/db";

// Next 16 note: with cacheComponents enabled, route segment config exports
// like `runtime` and `dynamic` are not allowed. The Node.js runtime is the
// default, and `connection()` opts the handler into request-time execution so
// the health check runs on every request instead of being prerendered.
export async function GET() {
  try {
    await connection();
    const dataSource = await getDataSource();
    await dataSource.query("SELECT 1");
    return success({ ok: true });
  } catch {
    // Deliberately no error details: never leak connection strings.
    console.error("[/api/health] database check failed");
    return internalError();
  }
}
