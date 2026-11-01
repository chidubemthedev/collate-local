type CoverageFilter = {
  key: "stateId" | "lgaId" | "wardId" | "politicalUnitId";
  sql: (parameter: number) => string;
};

const coverageFilters: CoverageFilter[] = [
  { key: "stateId", sql: (parameter) => `s.id = $${parameter}` },
  { key: "lgaId", sql: (parameter) => `l.id = $${parameter}` },
  { key: "wardId", sql: (parameter) => `w.id = $${parameter}` },
  {
    key: "politicalUnitId",
    sql: (parameter) => `EXISTS (
      SELECT 1 FROM pu_political_unit filter_ppu
      WHERE filter_ppu.polling_unit_id = pu.id
        AND filter_ppu.political_unit_id = $${parameter}
    )`,
  },
];

export function parseCoverageFilters(
  searchParams: URLSearchParams,
  firstParameter: number,
): { clauses: string[]; parameters: number[] } | { error: Response } {
  const clauses: string[] = [];
  const parameters: number[] = [];

  for (const filter of coverageFilters) {
    const rawValue = searchParams.get(filter.key);
    if (rawValue === null) continue;

    const value = Number(rawValue);
    if (!Number.isSafeInteger(value) || value <= 0) {
      return {
        error: Response.json({ error: `invalid_${filter.key}` }, { status: 400 }),
      };
    }

    const parameter = firstParameter + parameters.length;
    clauses.push(filter.sql(parameter));
    parameters.push(value);
  }

  return { clauses, parameters };
}
