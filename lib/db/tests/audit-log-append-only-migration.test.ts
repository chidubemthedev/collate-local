import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../migrations/1790000002000-AddAuditLogAppendOnlyTrigger.ts", import.meta.url),
  "utf8",
);

describe("AddAuditLogAppendOnlyTrigger migration", () => {
  it("creates an update/delete rejecting function and trigger", () => {
    expect(migration).toContain("CREATE FUNCTION prevent_audit_log_mutation()");
    expect(migration).toContain("RAISE EXCEPTION");
    expect(migration).toMatch(
      /CREATE TRIGGER audit_log_append_only\s+BEFORE UPDATE OR DELETE ON audit_log/,
    );
  });

  it("drops the trigger before its function in down", () => {
    const down = migration.slice(migration.indexOf("public async down"));
    expect(down.indexOf("DROP TRIGGER")).toBeGreaterThanOrEqual(0);
    expect(down.indexOf("DROP FUNCTION")).toBeGreaterThan(down.indexOf("DROP TRIGGER"));
  });
});
