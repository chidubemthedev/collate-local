import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireApiAuth: vi.fn(), query: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth/api", () => ({ requireApiAuth: mocks.requireApiAuth }));

import { encodeCandidateCursor } from "@/lib/invites/invites";
import { GET } from "./route";

function signIn(isAdmin: boolean) {
  mocks.requireApiAuth.mockResolvedValue({ ok: true, context: { isAdmin, dataSource: { query: mocks.query } } });
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    full_name: "KASHIM IBRAHIM MUHAMMAD",
    person_email: null,
    principal_candidate_id: null,
    principal_name: null,
    office_name: "Governor",
    level: 2,
    unit_name: "BAUCHI",
    unit_sort: "bauchi",
    family: 10,
    mate: 0,
    invite_email: null,
    invite_revoked: null,
    invite_accepted_at: null,
    invite_expires_at: null,
    invite_created_at: null,
    status: "not_invited",
    ...overrides,
  };
}

const get = (query = "") => GET(new Request(`http://localhost:3000/api/settings/candidates${query}`));

describe("GET /api/settings/candidates", () => {
  beforeEach(() => {
    mocks.requireApiAuth.mockReset();
    mocks.query.mockReset();
  });

  it("lists candidates and running mates with their status, in title case, and pages by cursor", async () => {
    signIn(true);
    const created = new Date("2026-11-07T10:00:00Z");
    const expires = new Date("2026-11-08T10:00:00Z");
    mocks.query.mockResolvedValueOnce([
      row(),
      row({
        id: 11,
        full_name: "TATA ALHAJI",
        principal_candidate_id: 10,
        principal_name: "KASHIM IBRAHIM MUHAMMAD",
        mate: 1,
        status: "invited",
        invite_email: "tata@example.com",
        invite_created_at: created,
        invite_expires_at: expires,
      }),
      row({ id: 12, family: 12 }),
    ]);
    mocks.query.mockResolvedValueOnce([{ total: 3 }]);

    const response = await get("?limit=2");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([
      {
        candidateId: 10,
        fullName: "Kashim Ibrahim Muhammad",
        title: "Governor",
        seat: "Bauchi",
        principalCandidateId: null,
        principalName: null,
        isRunningMate: false,
        status: "not_invited",
        email: null,
        invitedAt: null,
        expiresAt: null,
      },
      {
        candidateId: 11,
        fullName: "Tata Alhaji",
        title: "Deputy Governor",
        seat: "Bauchi",
        principalCandidateId: 10,
        principalName: "Kashim Ibrahim Muhammad",
        isRunningMate: true,
        status: "invited",
        email: "ta***@example.com",
        invitedAt: created.toISOString(),
        expiresAt: expires.toISOString(),
      },
    ]);
    expect(body.meta.nextCursor).toBe(encodeCandidateCursor({ level: 2, unit: "bauchi", family: 10, mate: 1, id: 11 }));
    expect(body.meta.total).toBe(3);
    expect(mocks.query.mock.calls[0][1]).toEqual([null, null, null, null, null, null, null, null, 3]);
    // The count uses the same filters, without the cursor.
    expect(String(mocks.query.mock.calls[1][0])).toContain("COUNT(*)");
    expect(mocks.query.mock.calls[1][1]).toEqual([null, null, null]);
  });

  it("passes search, office, status and cursor through", async () => {
    signIn(true);
    mocks.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);
    const cursor = encodeCandidateCursor({ level: 2, unit: "bauchi", family: 10, mate: 0, id: 10 });
    const response = await get(`?q=awka&office=House%20of%20Reps&status=expired&cursor=${cursor}`);
    expect(response.status).toBe(200);
    expect(mocks.query.mock.calls[0][1]).toEqual(["%awka%", "House of Reps", "expired", 2, "bauchi", 10, 0, 10, 26]);
    expect(mocks.query.mock.calls[1][1]).toEqual(["%awka%", "House of Reps", "expired"]);
  });

  it("rejects unknown filters, bad limits and cursors", async () => {
    signIn(true);
    expect((await get("?office=Mayor")).status).toBe(400);
    expect((await get("?status=lost")).status).toBe(400);
    expect((await get("?limit=0")).status).toBe(400);
    expect((await get("?cursor=x!")).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("is for admins only", async () => {
    signIn(false);
    expect((await get()).status).toBe(403);
  });
});
