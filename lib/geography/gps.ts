import { z } from "zod";

export const gpsFilterSchema = z.enum(["all", "with", "without"]).default("all");

export type GpsFilter = z.infer<typeof gpsFilterSchema>;

export function hasGpsSql(alias: string): string {
  return `(${alias}.latitude IS NOT NULL AND ${alias}.longitude IS NOT NULL AND NOT (${alias}.latitude = 0 AND ${alias}.longitude = 0))`;
}

export function gpsFilterSql(filter: GpsFilter, alias: string): string | null {
  if (filter === "all") {
    return null;
  }

  const expression = hasGpsSql(alias);
  return filter === "with" ? expression : `NOT ${expression}`;
}
