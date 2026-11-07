import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../migrations/1790000006000-RenameAccessLinkToInviteAccessLink.ts", import.meta.url),
  "utf8",
)
  // Git on Windows may check the file out with CRLF line endings.
  .replace(/\r\n/g, "\n");
const up = migration.slice(migration.indexOf("public async up"), migration.indexOf("public async down"));
const down = migration.slice(migration.indexOf("public async down"));

describe("RenameAccessLinkToInviteAccessLink migration", () => {
  it("renames the table and its constraints", () => {
    expect(up).toContain("ALTER TABLE access_link RENAME TO invite_access_link");
    expect(up).toContain("RENAME CONSTRAINT access_link_pkey TO invite_access_link_pkey");
    expect(up).toContain("RENAME CONSTRAINT access_link_token_hash_key TO invite_access_link_token_hash_key");
    expect(up).toContain("RENAME CONSTRAINT fk_access_link_candidate TO fk_invite_access_link_candidate");
  });

  it("adds the invite columns, with the email required", () => {
    expect(up).toMatch(/ADD COLUMN email_address VARCHAR,\s+ADD COLUMN accepted_at TIMESTAMPTZ,\s+ADD COLUMN invited_by_person_id UUID/);
    expect(up.indexOf("DELETE FROM invite_access_link WHERE email_address IS NULL")).toBeLessThan(
      up.indexOf("ALTER COLUMN email_address SET NOT NULL"),
    );
    expect(up).toMatch(/FOREIGN KEY \(invited_by_person_id\)\s+REFERENCES person \(id\) ON DELETE SET NULL/);
    expect(up).toContain("CREATE INDEX ix_invite_access_link_candidate_id ON invite_access_link (candidate_id)");
    expect(up).toContain("CREATE INDEX ix_invite_access_link_email ON invite_access_link (LOWER(email_address))");
  });

  it("can be undone, ending with the old name", () => {
    expect(down).toMatch(/DROP COLUMN invited_by_person_id,\s+DROP COLUMN accepted_at,\s+DROP COLUMN email_address/);
    expect(down.trimEnd()).toMatch(/ALTER TABLE invite_access_link RENAME TO access_link;`\);\s*\}\s*\}$/);
  });
});
