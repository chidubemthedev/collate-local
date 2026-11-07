import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../migrations/1790000005000-AddGroupTypeTable.ts", import.meta.url),
  "utf8",
)
  // Git on Windows may check the file out with CRLF line endings.
  .replace(/\r\n/g, "\n");
const up = migration.slice(migration.indexOf("public async up"), migration.indexOf("public async down"));
const down = migration.slice(migration.indexOf("public async down"));

describe("AddGroupTypeTable migration", () => {
  it("renames the old enum before creating the group_type table, so the names do not clash", () => {
    const rename = up.indexOf("ALTER TYPE group_type RENAME TO group_type_legacy");
    expect(rename).toBeGreaterThan(-1);
    expect(rename).toBeLessThan(up.indexOf("CREATE TABLE group_type"));
  });

  it("creates the rules columns and a case-insensitive unique name", () => {
    expect(up).toContain("CREATE TYPE group_can_message AS ENUM ('none', 'agents_they_cover', 'all_agents')");
    expect(up).toContain("CREATE TYPE group_sees_coverage AS ENUM ('national', 'own_area')");
    expect(up).toMatch(/type_key VARCHAR\(40\) UNIQUE,/);
    expect(up).toMatch(/can_own_agents BOOLEAN NOT NULL DEFAULT TRUE/);
    expect(up).toContain("CREATE UNIQUE INDEX uq_group_type_name ON group_type (LOWER(type_name))");
  });

  it("adds the four built-in types with their rules", () => {
    expect(up).toContain("('admin', 'Admin', 'all_agents', 'national', FALSE, TRUE)");
    expect(up).toContain("('party', 'Party', 'agents_they_cover', 'national', TRUE, TRUE)");
    expect(up).toContain("('campaign', 'Campaign', 'agents_they_cover', 'own_area', TRUE, TRUE)");
    expect(up).toContain("('support_group', 'Support group', 'none', 'own_area', TRUE, TRUE)");
  });

  it("moves every group to group_type_id by key, then drops the old column and enum", () => {
    expect(up).toMatch(/WHERE t\.type_key = g\.group_type::text/);
    expect(up).toContain("ALTER COLUMN group_type_id SET NOT NULL");
    expect(up).toMatch(/FOREIGN KEY \(group_type_id\) REFERENCES group_type \(id\) ON DELETE RESTRICT/);
    expect(up).toContain("CREATE INDEX ix_groups_group_type_id ON groups (group_type_id)");
    expect(up.indexOf("DROP COLUMN group_type;")).toBeGreaterThan(up.indexOf("SET NOT NULL"));
    expect(up).toContain("DROP TYPE group_type_legacy");
  });

  it("can be undone, mapping types an admin made back to party or campaign", () => {
    expect(down).toMatch(/COALESCE\(t\.type_key, CASE WHEN t\.sees_coverage = 'national' THEN 'party' ELSE 'campaign' END\)/);
    expect(down).toContain("ALTER TABLE groups DROP COLUMN group_type_id");
    expect(down).toContain("DROP TABLE group_type");
    expect(down.indexOf("ALTER TYPE group_type_legacy RENAME TO group_type")).toBeGreaterThan(
      down.indexOf("DROP TABLE group_type"),
    );
  });
});
