import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../migrations/1790000009000-DropPersonHomePollingUnitAndVoterCard.ts", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");
const up = migration.slice(migration.indexOf("public async up"), migration.indexOf("public async down"));
const down = migration.slice(migration.indexOf("public async down"));

describe("DropPersonHomePollingUnitAndVoterCard migration", () => {
  it("drops the home polling unit (and its foreign key) and the voter card number", () => {
    expect(up).toContain("DROP CONSTRAINT IF EXISTS fk_person_home_polling_unit");
    expect(up).toContain("ALTER TABLE person DROP COLUMN home_polling_unit_id;");
    expect(up).toContain("ALTER TABLE person DROP COLUMN voter_card_number;");
  });

  it("can be undone with nullable columns", () => {
    expect(down).toContain("ADD COLUMN voter_card_number VARCHAR;");
    expect(down).toContain("ADD COLUMN home_polling_unit_id INT;");
    expect(down).toContain("FOREIGN KEY (home_polling_unit_id) REFERENCES polling_unit (id) ON DELETE SET NULL");
    expect(down).not.toContain("NOT NULL");
  });
});
