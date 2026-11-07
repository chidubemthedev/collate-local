import { describe, expect, it } from "vitest";
import { auditActionLabel, decodeAuditCursor, encodeAuditCursor, parseAuditDate } from "./audit-log";

describe("auditActionLabel", () => {
  it("puts known actions in plain words and leaves others as stored", () => {
    expect(auditActionLabel("settings.admin.created")).toBe("Added an admin");
    expect(auditActionLabel("view_agents")).toBe("Viewed agents");
    expect(auditActionLabel("something_new")).toBe("something_new");
  });
});

describe("parseAuditDate", () => {
  it("accepts real calendar days only", () => {
    expect(parseAuditDate("2026-11-07")).toBe("2026-11-07");
    expect(parseAuditDate("2026-02-30")).toBeNull();
    expect(parseAuditDate("7/11/2026")).toBeNull();
    expect(parseAuditDate(null)).toBeNull();
  });
});

describe("audit cursor", () => {
  it("round-trips the time (to the microsecond) and id, and refuses anything else", () => {
    const cursor = { at: "2026-11-06T00:43:03.408848Z", id: "56" };
    expect(decodeAuditCursor(encodeAuditCursor(cursor))).toEqual(cursor);
    expect(decodeAuditCursor("nope!")).toBeNull();
    expect(decodeAuditCursor(Buffer.from(JSON.stringify(["2026-11-06T00:43:03Z", "56"])).toString("base64url"))).toBeNull();
    expect(decodeAuditCursor(Buffer.from(JSON.stringify(["2026-11-06T00:43:03.408848Z", "x"])).toString("base64url"))).toBeNull();
  });
});
