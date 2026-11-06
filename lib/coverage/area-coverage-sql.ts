/**
 * SQL pieces shared by the states / LGAs / wards coverage lists.
 * The lists join each area to its polling units and to the polling unit's official agent (at most
 * one per polling unit), so extra agents have to be counted on their own; joining them in too
 * would repeat polling-unit rows and inflate every other count.
 */

/**
 * Distinct extra agents per area, as a CTE body: `area_id`, `extra_agents`.
 * `areaColumn` is `s.id`, `l.id` or `w.id`; `whereSql` holds the same scope and polling-unit
 * filters as the main query (aliases s, l, w, pu), so both count the same polling units.
 */
export function extraAgentsByAreaSql(areaColumn: string, whereSql: string): string {
  return `
        SELECT ${areaColumn} AS area_id, COUNT(DISTINCT xa.person_id) AS extra_agents
        FROM agent_assignment xa
        JOIN polling_unit pu ON pu.id = xa.polling_unit_id
        JOIN ward w ON w.id = pu.ward_id
        JOIN lga l ON l.id = w.lga_id
        JOIN state s ON s.id = l.state_id
        WHERE xa.agent_kind = 'extra' AND ${whereSql}
        GROUP BY ${areaColumn}`;
}
