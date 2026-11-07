import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../migrations/1790000007000-AddAuditLogCreatedAtIndex.ts", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

describe("AddAuditLogCreatedAtIndex migration", () => {
  it("adds a newest-first index and drops it on the way down", () => {
    expect(migration).toContain("CREATE INDEX ix_audit_log_created_at_id ON audit_log (created_at DESC, id DESC)");
    expect(migration).toContain("DROP INDEX IF EXISTS ix_audit_log_created_at_id");
  });
});
