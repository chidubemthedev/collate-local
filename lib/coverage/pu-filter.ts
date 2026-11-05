import { gpsFilterSchema, hasGpsSql } from "../geography/gps";
import { z } from "zod";

export const coverageStatusFilterSchema = z.enum(["all", "gaps"]).default("all");

export type CoverageStatusFilter = z.infer<typeof coverageStatusFilterSchema>;

export interface PollingUnitFilter {
  gps: "all" | "with" | "without";
  coverage: CoverageStatusFilter;
}

export function parsePollingUnitFilter(
  searchParams: URLSearchParams,
): PollingUnitFilter | { error: Response } {
  const gps = gpsFilterSchema.safeParse(searchParams.get("gps") ?? undefined);
  if (!gps.success) {
    return { error: Response.json({ error: "invalid_gps" }, { status: 400 }) };
  }

  const coverage = coverageStatusFilterSchema.safeParse(searchParams.get("coverage") ?? undefined);
  if (!coverage.success) {
    return { error: Response.json({ error: "invalid_coverage" }, { status: 400 }) };
  }

  return { gps: gps.data, coverage: coverage.data };
}

export function officialGapSql(alias: string): string {
  return `NOT EXISTS (
    SELECT 1 FROM agent_assignment gap_aa
    WHERE gap_aa.polling_unit_id = ${alias}.id
      AND gap_aa.agent_kind = 'official'
  )`;
}

// Clauses take no bind parameters, so they can be appended to any query without renumbering.
export function pollingUnitFilterClauses(filter: PollingUnitFilter, alias = "pu"): string[] {
  const clauses: string[] = [];

  if (filter.gps === "with") clauses.push(hasGpsSql(alias));
  if (filter.gps === "without") clauses.push(`NOT ${hasGpsSql(alias)}`);
  if (filter.coverage === "gaps") clauses.push(officialGapSql(alias));

  // Aggregates over LEFT JOINs must drop areas that have no matching polling unit.
  return clauses.length > 0 ? [`${alias}.id IS NOT NULL`, ...clauses] : clauses;
}
