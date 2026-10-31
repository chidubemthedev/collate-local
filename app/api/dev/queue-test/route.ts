import { connection } from "next/server";
import { enqueue } from "@/lib/queue";
import { TEST_JOB } from "@/lib/queue/names";

// Next 16 note: with cacheComponents enabled, route segment config exports
// like `runtime` are not allowed; the Node.js runtime is the default. An
// issue-#1 pattern applies here: `connection()` opts the handler into
// request-time execution.
export async function POST(request: Request) {
  // Dev-only utility: pretend this endpoint does not exist in production.
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }

  await connection();

  let count = 1;
  let fail = false;
  try {
    const body = (await request.json()) as { count?: unknown; fail?: unknown };
    if (typeof body?.count === "number" && Number.isFinite(body.count)) {
      // Clamp to [1, 50] per the endpoint's contract.
      count = Math.min(50, Math.max(1, Math.trunc(body.count)));
    }
    if (typeof body?.fail === "boolean") fail = body.fail;
  } catch {
    // No JSON body: fall through with defaults (1 job, no fail).
  }

  const ids: (string | null)[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(await enqueue(TEST_JOB, { n: i + 1, fail }));
  }
  return Response.json({ count: ids.length, ids });
}
