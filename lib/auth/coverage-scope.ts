/**
 * The SQL that limits coverage queries to the areas a user may see.
 * Kept free of server-only imports so it can be unit-tested directly; routes import it through
 * `@/lib/auth/api`.
 */

export type MembershipScope = {
  stateId: number | null;
  lgaId: number | null;
  wardId: number | null;
  politicalUnitId: number | null;
};

export type CoverageScopeContext = {
  hasGlobalCoverageAccess: boolean;
  scopes: MembershipScope[];
};

function uniqueIds(scopes: MembershipScope[], key: keyof MembershipScope): number[] {
  return [
    ...new Set(scopes.flatMap((scope) => (scope[key] === null ? [] : [scope[key] as number]))),
  ];
}

/**
 * Always binds five parameters, from `firstParameter`: global access, state ids, LGA ids,
 * ward ids and political-unit ids, so callers can number their own parameters after them.
 *
 * A kind of area the user has none of is written as `($n::int[] IS NULL)` instead of a real
 * test. That is always false (the list is empty, not null), and the planner can see it, so a
 * user limited to one state no longer pays for a constituency lookup on every polling unit
 * (national pages: about 75 ms -> 7 ms). When the user does have constituency scopes the SQL is
 * left as it was, because Postgres plans that version better.
 */
export function getCoverageScopeFilter(
  context: CoverageScopeContext,
  aliases: { state: string; lga: string; ward: string; pollingUnit: string },
  firstParameter = 1,
): { sql: string; parameters: unknown[] } {
  const stateIds = uniqueIds(context.scopes, "stateId");
  const lgaIds = uniqueIds(context.scopes, "lgaId");
  const wardIds = uniqueIds(context.scopes, "wardId");
  const politicalUnitIds = uniqueIds(context.scopes, "politicalUnitId");

  const globalParameter = `$${firstParameter}`;
  const stateParameter = `$${firstParameter + 1}`;
  const lgaParameter = `$${firstParameter + 2}`;
  const wardParameter = `$${firstParameter + 3}`;
  const politicalUnitParameter = `$${firstParameter + 4}`;

  const keepAll = politicalUnitIds.length > 0;
  const idTest = (ids: number[], column: string, parameter: string) =>
    keepAll || ids.length > 0
      ? `${column} = ANY(${parameter}::int[])`
      : `(${parameter}::int[] IS NULL)`;

  const politicalUnitTest = keepAll
    ? `EXISTS (
        SELECT 1
        FROM pu_political_unit scope_ppu
        WHERE scope_ppu.polling_unit_id = ${aliases.pollingUnit}.id
          AND scope_ppu.political_unit_id = ANY(${politicalUnitParameter}::int[])
      )`
    : `(${politicalUnitParameter}::int[] IS NULL)`;

  return {
    sql: `(
      ${globalParameter}::boolean
      OR ${idTest(stateIds, `${aliases.state}.id`, stateParameter)}
      OR ${idTest(lgaIds, `${aliases.lga}.id`, lgaParameter)}
      OR ${idTest(wardIds, `${aliases.ward}.id`, wardParameter)}
      OR ${politicalUnitTest}
    )`,
    parameters: [context.hasGlobalCoverageAccess, stateIds, lgaIds, wardIds, politicalUnitIds],
  };
}
