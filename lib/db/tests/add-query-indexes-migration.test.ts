import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../migrations/1790000003000-AddQueryIndexes.ts", import.meta.url),
  "utf8",
);
const up = migration.slice(migration.indexOf("public async up"), migration.indexOf("public async down"));
const down = migration.slice(migration.indexOf("public async down"));

const INDEXES = [
  "ix_polling_unit_ward_id",
  "ix_phone_number_person_id",
  "ix_consent_person_id_created_at",
  "ix_agent_assignment_owner_group_id",
  "ix_agent_assignment_owner_candidate_id",
  "ix_agent_assignment_extra_polling_unit",
  "ix_membership_group_id",
  "ix_membership_scope_unit_membership_id",
  "ix_delivery_broadcast_id_created_at",
];

describe("AddQueryIndexes migration", () => {
  it("creates each index once, safely re-runnable", () => {
    for (const name of INDEXES) {
      expect(up).toContain(`CREATE INDEX IF NOT EXISTS ${name}\n`);
    }
    expect(up.match(/CREATE INDEX/g)?.length).toBe(INDEXES.length);
  });

  it("indexes polling units by ward", () => {
    expect(up).toMatch(/ix_polling_unit_ward_id\s+ON polling_unit \(ward_id\)/);
  });

  it("keeps the extra-agent index to extra agents only", () => {
    expect(up).toMatch(
      /ix_agent_assignment_extra_polling_unit\s+ON agent_assignment \(polling_unit_id\) INCLUDE \(person_id\)\s+WHERE agent_kind = 'extra'/,
    );
  });

  it("drops every index it created in down", () => {
    for (const name of INDEXES) {
      expect(down).toContain(`DROP INDEX IF EXISTS ${name};`);
    }
  });
});
