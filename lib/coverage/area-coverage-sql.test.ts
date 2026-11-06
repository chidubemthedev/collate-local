import { describe, expect, it } from "vitest";
import { extraAgentsByAreaSql } from "./area-coverage-sql";

describe("extraAgentsByAreaSql", () => {
  it("counts distinct extra agents per area, with the caller's filters", () => {
    const sql = extraAgentsByAreaSql("l.id", "l.state_id = $6 AND (TRUE)");
    expect(sql).toContain("SELECT l.id AS area_id, COUNT(DISTINCT xa.person_id) AS extra_agents");
    expect(sql).toContain("WHERE xa.agent_kind = 'extra' AND l.state_id = $6 AND (TRUE)");
    expect(sql).toContain("GROUP BY l.id");
  });

  it("joins down to the state so the s / l / w / pu aliases work in the filters", () => {
    const sql = extraAgentsByAreaSql("s.id", "TRUE");
    for (const join of [
      "JOIN polling_unit pu ON pu.id = xa.polling_unit_id",
      "JOIN ward w ON w.id = pu.ward_id",
      "JOIN lga l ON l.id = w.lga_id",
      "JOIN state s ON s.id = l.state_id",
    ]) {
      expect(sql).toContain(join);
    }
  });
});
