import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../migrations/1790000008000-AddLoginOtpLinkToken.ts", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const up = migration.slice(migration.indexOf("public async up"), migration.indexOf("public async down"));
const down = migration.slice(migration.indexOf("public async down"));

describe("AddLoginOtpLinkToken migration", () => {
  it("adds a nullable, unique link token hash", () => {
    expect(up).toContain("ALTER TABLE login_otp ADD COLUMN link_token_hash VARCHAR;");
    expect(up).toContain("CREATE UNIQUE INDEX uq_login_otp_link_token_hash ON login_otp (link_token_hash)");
    expect(up).not.toContain("NOT NULL");
  });

  it("can be undone", () => {
    expect(down).toContain("DROP INDEX IF EXISTS uq_login_otp_link_token_hash");
    expect(down).toContain("ALTER TABLE login_otp DROP COLUMN link_token_hash");
  });
});
