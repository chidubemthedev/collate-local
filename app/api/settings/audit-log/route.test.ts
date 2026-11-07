import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireApiAuth: vi.fn(), query: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth/api", () => ({ requireApiAuth: mocks.requireApiAuth }));

import { encodeAuditCursor } from "@/lib/audit/audit-log";
import { GET } from "./route";

const ADMIN = "11111111-1111-4111-8111-111111111111";

function signIn(isAdmin: boolean) {
  mocks.requireApiAuth.mockResolvedValue({ ok: true, context: { isAdmin, dataSource: { query: mocks.query } } });
}

function entry(id: string, at: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    at,
    action_type: "settings.admin.created",
    actor_person_id: ADMIN,
    actor_name: "Ada Obi",
    target_entity_type: "person",
    target_entity_id: "22222222-2222-4222-8222-222222222222",
    target_name: "Bola Ade",
    ip_address: "102.89.1.2",
    ...overrides,
  };
}

const get = (query = "") => GET(new Request(`http://localhost:3000/api/settings/audit-log${query}`));

describe("GET /api/settings/audit-log", () => {
  beforeEach(() => {
    mocks.requireApiAuth.mockReset();
    mocks.query.mockReset();
  });

  it("lists changes newest first in plain words, with names, the total and a cursor", async () => {
    signIn(true);
    mocks.query
      .mockResolvedValueOnce([
        entry("9", "2026-11-07T10:00:00.000002Z"),
        entry("8", "2026-11-07T10:00:00.000001Z", {
          action_type: "telegram_linked",
          actor_person_id: null,
          actor_name: null,
          target_name: null,
        }),
        entry("7", "2026-11-07T09:00:00.000000Z"),
      ])
      .mockResolvedValueOnce([{ total: 40 }]);

    const response = await get("?limit=2");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data[0]).toEqual({
      id: "9",
      at: "2026-11-07T10:00:00.000002Z",
      action: "settings.admin.created",
      actionLabel: "Added an admin",
      isView: false,
      actor: { personId: ADMIN, name: "Ada Obi" },
      target: { type: "person", id: "22222222-2222-4222-8222-222222222222", name: "Bola Ade" },
      ipAddress: "102.89.1.2",
    });
    expect(body.data[1]).toMatchObject({ actionLabel: "Linked Telegram", actor: null });
    expect(body.meta).toMatchObject({ total: 40, limit: 2 });
    expect(body.meta.nextCursor).toBe(encodeAuditCursor({ at: "2026-11-07T10:00:00.000001Z", id: "8" }));

    const [sql, params] = mocks.query.mock.calls[0];
    expect(String(sql)).toContain("ORDER BY a.created_at DESC, a.id DESC");
    expect(params).toEqual(["changes", null, null, null, null, null, 3]);
    expect(mocks.query.mock.calls[1][1]).toEqual(["changes", null, null, null]);
  });

  it("passes the filters and cursor through, and counts only on the first page", async () => {
    signIn(true);
    mocks.query.mockResolvedValueOnce([]);
    const cursor = encodeAuditCursor({ at: "2026-11-07T10:00:00.000001Z", id: "8" });
    const response = await get(`?kind=views&q=ada_&from=2026-11-01&to=2026-11-07&cursor=${cursor}`);
    expect(response.status).toBe(200);
    expect((await response.json()).meta.total).toBeUndefined();
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query.mock.calls[0][1]).toEqual([
      "views",
      "%ada\\_%",
      "2026-11-01",
      "2026-11-07",
      "2026-11-07T10:00:00.000001Z",
      "8",
      26,
    ]);
  });

  it("rejects bad filters", async () => {
    signIn(true);
    expect((await get("?kind=deletes")).status).toBe(400);
    expect((await get("?from=2026-13-01")).status).toBe(400);
    expect((await get("?from=2026-11-08&to=2026-11-01")).status).toBe(400);
    expect((await get("?limit=101")).status).toBe(400);
    expect((await get("?cursor=x!")).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("is for admins only", async () => {
    signIn(false);
    expect((await get()).status).toBe(403);
    mocks.requireApiAuth.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    expect((await get()).status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
