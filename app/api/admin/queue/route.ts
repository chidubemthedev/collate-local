import { requireUser } from "@/lib/auth/current-user";
import { failure, internalError, success } from "@/lib/api/response";
import { policyUserFromCurrentUser } from "@/lib/policy";
import { policyErrorResponse } from "@/lib/policy/http";
import { getDataSource } from "@/lib/db";

export interface QueueSummaryRow {
  name: string;
  created: number;
  active: number;
  completed: number;
  failed: number;
  cancelled: number;
  total: number;
}

export interface RecentJob {
  id: string;
  name: string;
  state: string;
  createdOn: string;
  startedOn: string | null;
  completedOn: string | null;
  retryCount: number;
  retryLimit: number;
  output: string | null;
}

export async function GET(): Promise<Response> {
  try {
    const currentUser = await requireUser();
    const user = await policyUserFromCurrentUser(currentUser);
    if (!user.isAdmin) {
      return failure("forbidden", "Admin access required");
    }

    const dataSource = await getDataSource();

    const summary = (await dataSource.query(`
      SELECT
        name,
        COUNT(*) FILTER (WHERE state = 'created')::int   AS created,
        COUNT(*) FILTER (WHERE state = 'active')::int    AS active,
        COUNT(*) FILTER (WHERE state = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE state = 'failed')::int    AS failed,
        COUNT(*) FILTER (WHERE state = 'cancelled')::int AS cancelled,
        COUNT(*)::int                                    AS total
      FROM pgboss.job
      WHERE name NOT LIKE '__pgboss__%'
      GROUP BY name
      ORDER BY name;
    `)) as QueueSummaryRow[];

    const recent = (await dataSource.query(`
      SELECT
        id,
        name,
        state,
        created_on   AS "createdOn",
        started_on   AS "startedOn",
        completed_on AS "completedOn",
        retry_limit  AS "retryLimit",
        retry_count  AS "retryCount",
        CASE
          WHEN output IS NOT NULL THEN LEFT(output::text, 500)
          ELSE NULL
        END AS output
      FROM pgboss.job
      WHERE name NOT LIKE '__pgboss__%'
      ORDER BY created_on DESC
      LIMIT 50;
    `)) as RecentJob[];

    return success({ summary, recent });
  } catch (error) {
    const policyResponse = policyErrorResponse(error);
    if (policyResponse) return policyResponse;
    return internalError();
  }
}
