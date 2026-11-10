import "server-only";
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

export async function getAdminQueueData(): Promise<{
  summary: QueueSummaryRow[];
  recent: RecentJob[];
}> {
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
      -- Long enough for a full error and stack trace (shown in the Queue page's output popup).
      CASE
        WHEN output IS NOT NULL THEN LEFT(output::text, 8000)
        ELSE NULL
      END AS output
    FROM pgboss.job
    WHERE name NOT LIKE '__pgboss__%'
    ORDER BY created_on DESC
    LIMIT 50;
  `)) as RecentJob[];

  return { summary, recent };
}
