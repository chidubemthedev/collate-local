import { connection } from "next/server";
import { getDataSource } from "@/lib/db";

// Next 16 note: with cacheComponents enabled, route segment config exports
// like `runtime` and `dynamic` are not allowed. The Node.js runtime is the
// default, and `connection()` opts the handler into request-time execution so
// the health check runs on every request instead of being prerendered.
export async function GET() {
  await connection();
  try {
    const dataSource = await getDataSource();
    await dataSource.query("SELECT 1");
    return Response.json({ ok: true }, { status: 200 });
  } catch {
    // Deliberately no error details: never leak connection strings.
    console.error("[/api/health] database check failed");
    return Response.json({ ok: false }, { status: 500 });
  }
}
