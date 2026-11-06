import { describe, expect, it, vi } from "vitest";
import type { DataSource } from "typeorm";
import {
  countCandidates,
  decodeCandidateCoverageCursor,
  listCandidateCoverage,
} from "./candidate-coverage";

describe("decodeCandidateCoverageCursor", () => {
  it("decodes a level.id cursor", () => {
    expect(decodeCandidateCoverageCursor("2.15")).toEqual({ level: 2, id: 15 });
  });

  it("rejects malformed cursors", () => {
    expect(decodeCandidateCoverageCursor("abc")).toBeNull();
    expect(decodeCandidateCoverageCursor("1.2.3")).toBeNull();
    expect(decodeCandidateCoverageCursor("1; DROP")).toBeNull();
  });
});

const GEO_SQL = "s.id = $1";
const GEO_PARAMETERS = [7];

describe("countCandidates", () => {
  function setup(total: number | string = 9) {
    const query = vi.fn(async () => [{ total }]);
    const dataSource = { query } as unknown as DataSource;
    return { query, dataSource };
  }

  it("counts without the coverage aggregation and returns a number", async () => {
    const { query, dataSource } = setup("9");

    const total = await countCandidates({
      dataSource,
      geoSql: GEO_SQL,
      geoParameters: GEO_PARAMETERS,
      firstFreeParameter: 2,
      officeId: null,
    });

    expect(total).toBe(9);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("COUNT(*)");
    // The expensive per-unit totals and per-candidate coverage must not run for a count.
    expect(sql).not.toContain("unit_totals");
    expect(sql).not.toContain("agent_assignment");
    // The user's scope still limits which seats count.
    expect(sql).toContain(GEO_SQL);
  });

  it("binds office, nationalOnly and overlap after the geo parameters", async () => {
    const { query, dataSource } = setup();

    await countCandidates({
      dataSource,
      geoSql: GEO_SQL,
      geoParameters: GEO_PARAMETERS,
      firstFreeParameter: 2,
      officeId: 3,
      nationalOnly: true,
      overlap: { stateId: 4, lgaId: 17, wardId: null },
    });

    const [sql, parameters] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(parameters).toEqual([7, 3, true, 4, 17, null, null]);
    expect(sql).toContain("$2::int");
    expect(sql).toContain("$3::boolean");
    expect(sql).toContain("$4::int");
    expect(sql).toContain("$6::int");
    expect(sql).toContain("political_unit_type = 'country'");
  });

  it("defaults nationalOnly to false and overlap to no filter", async () => {
    const { query, dataSource } = setup();

    await countCandidates({
      dataSource,
      geoSql: GEO_SQL,
      geoParameters: GEO_PARAMETERS,
      firstFreeParameter: 2,
      officeId: null,
    });

    const [, parameters] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(parameters).toEqual([7, null, false, null, null, null, null]);
  });

  it("returns 0 when the database returns no row", async () => {
    const query = vi.fn(async () => []);
    const total = await countCandidates({
      dataSource: { query } as unknown as DataSource,
      geoSql: GEO_SQL,
      geoParameters: GEO_PARAMETERS,
      firstFreeParameter: 2,
      officeId: null,
    });
    expect(total).toBe(0);
  });
});

describe("listCandidateCoverage parameters", () => {
  function setup() {
    const query = vi.fn(async (sql: string) =>
      sql.includes("INSERT INTO audit_log") ? [] : [{ rows: [], offices: [] }],
    );
    return { query, dataSource: { query } as unknown as DataSource };
  }

  it("binds nationalOnly and the overlap area after the existing parameters", async () => {
    const { query, dataSource } = setup();

    await listCandidateCoverage({
      dataSource,
      actorPersonId: "11111111-1111-4111-8111-111111111111",
      ipAddress: null,
      geoSql: GEO_SQL,
      geoParameters: GEO_PARAMETERS,
      firstFreeParameter: 2,
      limit: 12,
      cursor: null,
      officeId: null,
      nationalOnly: true,
      overlap: { stateId: 4, lgaId: null, wardId: 301 },
    });

    const [sql, parameters] = query.mock.calls[0] as unknown as [string, unknown[]];
    // geo, level, id, limit+1, office, nationalOnly, overlap state / lga / ward, seats within access
    expect(parameters).toEqual([7, null, null, 13, null, true, 4, null, 301, null]);
    expect(sql).toContain("political_unit_type = 'country'");
    expect(sql).toContain("ov_ppu.political_unit_id");
    // Coverage totals stay clipped by the geo filter only, never by the overlap area.
    expect(sql).toMatch(/unit_totals AS MATERIALIZED \([\s\S]*WHERE s\.id = \$1[\s\S]*GROUP BY/);
  });

  it("counts covered polling units in the per-unit totals, not once per candidate", async () => {
    const { query, dataSource } = setup();

    await listCandidateCoverage({
      dataSource,
      actorPersonId: "11111111-1111-4111-8111-111111111111",
      ipAddress: null,
      geoSql: GEO_SQL,
      geoParameters: GEO_PARAMETERS,
      firstFreeParameter: 2,
      limit: 12,
      cursor: null,
      officeId: null,
    });

    const [sql] = query.mock.calls[0] as unknown as [string, unknown[]];
    const unitTotals = sql.slice(sql.indexOf("unit_totals AS MATERIALIZED"), sql.indexOf("page AS MATERIALIZED"));
    expect(unitTotals).toContain("COUNT(official.polling_unit_id) AS covered_pus");
    expect(unitTotals).toContain("official.agent_kind = 'official'");
    expect(sql).toContain("page.covered_pus");
    // No per-row scan for covered units, and no DISTINCT left in the per-row extra-agent count.
    expect(sql).not.toContain("COUNT(DISTINCT pu.id)");
    expect(sql).not.toContain("COUNT(DISTINCT aa.id)");
  });

  it("keeps the old behaviour when the new options are left out", async () => {
    const { query, dataSource } = setup();

    await listCandidateCoverage({
      dataSource,
      actorPersonId: "11111111-1111-4111-8111-111111111111",
      ipAddress: null,
      geoSql: GEO_SQL,
      geoParameters: GEO_PARAMETERS,
      firstFreeParameter: 2,
      limit: 12,
      cursor: null,
      officeId: 5,
    });

    const [, parameters] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(parameters).toEqual([7, null, null, 13, 5, false, null, null, null, null]);
  });

  it("limits the list and the office counts to seats inside the user's access", async () => {
    const { query, dataSource } = setup();

    await listCandidateCoverage({
      dataSource,
      actorPersonId: "11111111-1111-4111-8111-111111111111",
      ipAddress: null,
      geoSql: GEO_SQL,
      geoParameters: GEO_PARAMETERS,
      firstFreeParameter: 2,
      limit: 12,
      cursor: null,
      officeId: null,
      withinUnitIds: [155, 300],
    });

    const [sql, parameters] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(parameters[9]).toEqual([155, 300]);
    expect(sql).toContain("pun.id = ANY($10::int[])");
    expect(sql).toContain("oc_pun.id = ANY($10::int[])");
  });
});
