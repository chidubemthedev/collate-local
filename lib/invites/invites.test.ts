import { describe, expect, it } from "vitest";
import {
  createInviteToken,
  decodeCandidateCursor,
  encodeCandidateCursor,
  hashInviteToken,
  INVITE_TTL_MS,
  inviteStatus,
  isInviteTokenShape,
  linkState,
  parseInviteEmail,
  publicBaseUrl,
} from "./invites";

const NOW = Date.parse("2026-11-07T12:00:00Z");
const later = new Date(NOW + 60_000);
const earlier = new Date(NOW - 60_000);

describe("invite tokens", () => {
  it("are long random URL-safe strings, stored only as a SHA-256 hash", () => {
    const token = createInviteToken();
    expect(isInviteTokenShape(token)).toBe(true);
    expect(createInviteToken()).not.toBe(token);
    expect(hashInviteToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
    expect(isInviteTokenShape("short")).toBe(false);
    expect(isInviteTokenShape(`${token.slice(0, 42)}!`)).toBe(false);
  });

  it("last 24 hours", () => {
    expect(INVITE_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe("publicBaseUrl", () => {
  const request = "http://localhost:3000/api/settings/candidates/1/invite";

  it("uses SERVER_BASE_URL when set, without a path or trailing slash", () => {
    expect(publicBaseUrl(request, "https://collate.ng")).toBe("https://collate.ng");
    expect(publicBaseUrl(request, "https://collate.ng/app/")).toBe("https://collate.ng");
  });

  it("falls back to the request's address when unset or not a web URL", () => {
    expect(publicBaseUrl(request, undefined)).toBe("http://localhost:3000");
    expect(publicBaseUrl(request, "")).toBe("http://localhost:3000");
    expect(publicBaseUrl(request, "/")).toBe("http://localhost:3000");
    expect(publicBaseUrl(request, "ftp://collate.ng")).toBe("http://localhost:3000");
  });
});

describe("parseInviteEmail", () => {
  it("lower-cases and trims", () => {
    expect(parseInviteEmail({ email: "  Ada@Example.COM " })).toEqual({ ok: true, email: "ada@example.com" });
  });

  it("rejects a missing or bad email", () => {
    expect(parseInviteEmail({}).ok).toBe(false);
    expect(parseInviteEmail({ email: "nope" }).ok).toBe(false);
    expect(parseInviteEmail(null).ok).toBe(false);
    expect(parseInviteEmail({ email: `${"a".repeat(250)}@b.co` }).ok).toBe(false);
  });
});

describe("inviteStatus", () => {
  const invite = { isRevoked: false, acceptedAt: null, expiresAt: later };

  it("is registered once the candidate has an email", () => {
    expect(inviteStatus("ada@example.com", invite, NOW)).toBe("registered");
  });

  it("follows the latest invite otherwise", () => {
    expect(inviteStatus(null, null, NOW)).toBe("not_invited");
    expect(inviteStatus(null, invite, NOW)).toBe("invited");
    expect(inviteStatus(null, { ...invite, expiresAt: earlier }, NOW)).toBe("expired");
    expect(inviteStatus(null, { ...invite, isRevoked: true }, NOW)).toBe("not_invited");
  });
});

describe("linkState", () => {
  const link = { isRevoked: false, acceptedAt: null, expiresAt: later };

  it("is valid until used, cancelled or 24 hours old", () => {
    expect(linkState(link, NOW)).toBe("valid");
    expect(linkState({ ...link, acceptedAt: earlier }, NOW)).toBe("used");
    expect(linkState({ ...link, isRevoked: true }, NOW)).toBe("cancelled");
    expect(linkState({ ...link, expiresAt: earlier }, NOW)).toBe("expired");
  });
});

describe("candidate cursor", () => {
  it("round-trips and refuses anything else", () => {
    const cursor = { level: 3, unit: "awka north/awka south", family: 12, mate: 0, id: 12 };
    expect(decodeCandidateCursor(encodeCandidateCursor(cursor))).toEqual(cursor);
    expect(decodeCandidateCursor("not a cursor")).toBeNull();
    expect(decodeCandidateCursor(Buffer.from(JSON.stringify([1, "a", 2, 5, 3])).toString("base64url"))).toBeNull();
  });
});
