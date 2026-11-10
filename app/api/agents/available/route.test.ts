import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireApiAuth: vi.fn(), query: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth/api", () => ({ requireApiAuth: mocks.requireApiAuth }));
vi.mock("@/lib/policy", () => ({ maskPhoneNumber: (value: string | null) => (value ? `masked:${value}` : null) }));

import { encodeAdminCursor } from "@/lib/settings/admins";
import { GET } from "./route";

const ORIGIN = "http://localhost:3000";
const ADA = "11111111-1111-4111-8111-111111111111";
const BOLA = "22222222-2222-4222-8222-222222222222";
const CHI = "33333333-3333-4333-8333-333333333333";

function signIn(isAdmin = false) {
  mocks.requireApiAuth.mockResolvedValue({
    ok: true,
    context: { isAdmin, viewAs: null, personId: ADA, dataSource: { query: mocks.query } },
  });
}

function row(id: string, name: string, extra: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    full_name: name,
    sort_name: name.toLowerCase(),
    phone: "+2348031234567",
    telegram_linked: false,
    is_candidate: false,
    ...extra,
  };
}

function get(query = "") {
  return GET(new Request(`${ORIGIN}/api/agents/available${query}`));
}

describe("GET /api/agents/available", () => {
  beforeEach(() => {
    mocks.requireApiAuth.mockReset();
    mocks.query.mockReset();
  });

  it("requires sign-in", async () => {
    mocks.requireApiAuth.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    expect((await get()).status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("is open to every signed-in user, not just admins", async () => {
    signIn(false);
    mocks.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);
    expect((await get()).status).toBe(200);
  });

  it("lists people who are not agents and not admins, with masked phones", async () => {
    signIn();
    mocks.query
      .mockResolvedValueOnce([row(ADA, "Ada Obi", { telegram_linked: true, is_candidate: true })])
      .mockResolvedValueOnce([{ total: 1 }]);

    const body = await (await get()).json();

    expect(body.data).toEqual([
      {
        personId: ADA,
        fullName: "Ada Obi",
        phone: "masked:+2348031234567",
        telegramLinked: true,
        isCandidate: true,
      },
    ]);
    expect(body.meta).toEqual({ nextCursor: null, limit: 20, total: 1 });
    const [sql] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("NOT EXISTS (SELECT 1 FROM agent_assignment aa WHERE aa.person_id = p.id)");
    expect(sql).toContain("gt.type_key = 'admin'");
  });

  it("searches names only, matching % and _ literally", async () => {
    signIn();
    mocks.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    await get("?q=%20%20ad%25a_%20%20");

    const [sql, parameters] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(parameters[0]).toBe("%ad\\%a\\_%");
    expect(sql).toContain("p.full_name ILIKE $1");
    expect(sql).not.toContain("e164_number ILIKE");
  });

  it("pages by name cursor and counts only on the first page", async () => {
    signIn();
    mocks.query
      .mockResolvedValueOnce([row(ADA, "Ada Obi"), row(BOLA, "Bola Ade"), row(CHI, "Chi Eze")])
      .mockResolvedValueOnce([{ total: 3 }]);

    const first = await (await get("?limit=2")).json();
    expect(first.data.map((item: { personId: string }) => item.personId)).toEqual([ADA, BOLA]);
    expect(first.meta.total).toBe(3);
    expect(first.meta.nextCursor).toBe(encodeAdminCursor({ name: "bola ade", id: BOLA }));

    mocks.query.mockReset();
    mocks.query.mockResolvedValueOnce([row(CHI, "Chi Eze")]);
    const second = await (await get(`?limit=2&cursor=${first.meta.nextCursor}`)).json();
    expect(second.data.map((item: { personId: string }) => item.personId)).toEqual([CHI]);
    expect(second.meta).toEqual({ nextCursor: null, limit: 2 });
    expect(mocks.query).toHaveBeenCalledTimes(1);
    const [, parameters] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(parameters.slice(1, 4)).toEqual(["bola ade", BOLA, 3]);
  });

  it("rejects a bad limit, cursor or over-long search", async () => {
    signIn();
    expect((await get("?limit=0")).status).toBe(400);
    expect((await get("?limit=51")).status).toBe(400);
    expect((await get("?cursor=not-a-cursor!")).status).toBe(400);
    expect((await get(`?q=${"a".repeat(101)}`)).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("returns a generic 500 when the database fails", async () => {
    signIn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.query.mockRejectedValue(new Error("db down"));
    expect((await get()).status).toBe(500);
    consoleError.mockRestore();
  });
});
