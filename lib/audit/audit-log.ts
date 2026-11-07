/**
 * Settings · Audit log: what each action means in plain words, the filters and the cursor.
 * Pure helpers, shared by the API route, the page and the tests.
 */
export const AUDIT_PAGE_SIZE = 25;
export const AUDIT_PAGE_SIZE_MAX = 100;

/** Plain words for every action the app records. Anything else is shown as stored. */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "coverage.assignment.created": "Assigned an agent",
  "coverage.assignment.deleted": "Removed an agent",
  create_broadcast: "Sent a broadcast",
  "settings.group_type.created": "Created a group",
  "settings.group_type.deleted": "Deleted a group",
  "settings.admin.created": "Added an admin",
  "settings.admin.removed": "Removed an admin",
  "settings.candidate.invited": "Invited a candidate",
  "settings.candidate.invite_cancelled": "Cancelled a candidate invite",
  "invite.accepted": "Completed registration",
  telegram_linked: "Linked Telegram",
  telegram_link_conflict: "Telegram link refused",
  consent_recorded: "Recorded consent",
  view_agents: "Viewed agents",
  view_ward_polling_units: "Viewed a ward's polling units",
  view_broadcasts: "Viewed broadcasts",
  view_broadcast: "Viewed a broadcast",
  view_broadcast_deliveries: "Viewed broadcast deliveries",
  view_candidate_coverage: "Viewed candidate coverage",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action;
}

/** Views are logged on every list load; changes are everything else. */
export type AuditKind = "changes" | "views" | "all";
export const AUDIT_KINDS: AuditKind[] = ["changes", "views", "all"];

/** "2026-11-07": a calendar day, or null if it isn't one. */
export function parseAuditDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

/** Where the next page starts: after this time (to the microsecond) and id. */
export interface AuditCursor {
  at: string;
  id: string;
}

export function encodeAuditCursor(cursor: AuditCursor): string {
  return Buffer.from(JSON.stringify([cursor.at, cursor.id]), "utf8").toString("base64url");
}

export function decodeAuditCursor(value: string): AuditCursor | null {
  if (value.length > 256 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(parsed[0]) &&
      typeof parsed[1] === "string" &&
      /^[1-9][0-9]{0,18}$/.test(parsed[1])
    ) {
      return { at: parsed[0], id: parsed[1] };
    }
  } catch {
    // Falls through to null.
  }
  return null;
}
