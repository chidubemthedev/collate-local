/**
 * Agents page · "Assign official agent": who can be picked as a new agent.
 * Pure helpers, shared by GET /api/agents/available and its tests.
 *
 * Anyone in the database can be picked, except people who are already agents somewhere (a person
 * is never an agent twice) and admins. Every signed-in user searches the same list; phones are masked.
 */
export const AVAILABLE_AGENTS_PAGE_SIZE = 20;
export const AVAILABLE_AGENTS_PAGE_SIZE_MAX = 50;
export const AVAILABLE_AGENTS_QUERY_MAX = 100;

/** People not yet agents and not admins. `p` is the person. */
export const AVAILABLE_PERSON_SQL = `
  NOT EXISTS (SELECT 1 FROM agent_assignment aa WHERE aa.person_id = p.id)
  AND NOT EXISTS (
    SELECT 1
    FROM membership m
    JOIN groups g ON g.id = m.group_id
    JOIN group_type gt ON gt.id = g.group_type_id
    WHERE m.person_id = p.id AND gt.type_key = 'admin'
  )
`;

/** A plain "contains" pattern for ILIKE, so % and _ typed by the user are matched literally. */
export function containsPattern(q: string): string | null {
  return q ? `%${q.replace(/[\\%_]/g, (character) => `\\${character}`)}%` : null;
}
