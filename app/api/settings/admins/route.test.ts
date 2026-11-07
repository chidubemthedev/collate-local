import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireApiAuth: vi.fn(), query: vi.fn(), managerQuery: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth/api", () => ({
  requireApiAuth: mocks.requireApiAuth,
  readOnlyResponse: () => new Response(null, { status: 403 }),
}));
vi.mock("@/lib/policy", () => ({ maskPhoneNumber: (value: string | null) => (value ? `masked:${value}` : null) }));

import { encodeAdminCursor } from "@/lib/settings/admins";
import { GET, POST } from "./route";

const ORIGIN = "http://localhost:3000";
const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function signIn(isAdmin: boolean, viewAs: { label: string; seatId: number | null } | null = null) {
  mocks.requireApiAuth.mockResolvedValue({
    ok: true,
    context: {
      isAdmin,
      viewAs,
      personId: ME,
      dataSource: {
        query: mocks.query,
        transaction: (work: (manager: { query: typeof mocks.managerQuery }) => unknown) =>
          work({ query: mocks.managerQuery }),
      },
    },
  });
}

function adminRow(id: string, name: string) {
  return {
    id,
    full_name: name,
    sort_name: name.toLowerCase(),
    email_address: `${name.toLowerCase().replace(" ", ".")}@example.com`,
    phone: null,
    group_names: ["Collate Admins"],
  };
}

function get(query = "") {
  return GET(new Request(`${ORIGIN}/api/settings/admins${query}`));
}

function post(body: unknown, origin: string | null = ORIGIN) {
  return POST(
    new Request(`${ORIGIN}/api/settings/admins`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

const NEW_ADMIN = { fullName: "Ada Obi", email: "Ada.Obi@example.com", phone: "+2348031234567" };

describe("GET /api/settings/admins", () => {
  beforeEach(() => {
    mocks.requireApiAuth.mockReset();
    mocks.query.mockReset();
  });

  it("lists admins with masked contacts, marks the viewer, and pages by cursor", async () => {
    signIn(true);
    mocks.query
      .mockResolvedValueOnce([adminRow(ME, "Ada Obi"), adminRow(OTHER, "Bola Ade"), adminRow(OTHER, "Chi Eze")])
      .mockResolvedValueOnce([{ total: 3 }]);
    const response = await get("?limit=2");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toEqual({
      personId: ME,
      fullName: "Ada Obi",
      email: "ad***@example.com",
      phone: null,
      groups: ["Collate Admins"],
      isYou: true,
    });
    expect(body.data[1].isYou).toBe(false);
    expect(body.meta.nextCursor).toBe(encodeAdminCursor({ name: "bola ade", id: OTHER }));
    expect(body.meta.total).toBe(3);
    expect(String(mocks.query.mock.calls[1][0])).toContain("COUNT(DISTINCT p.id)");
    expect(mocks.query.mock.calls[1][1]).toEqual([null]);

    const [sql, params] = mocks.query.mock.calls[0];
    expect(String(sql)).toContain("gt.type_key = 'admin'");
    expect(params).toEqual([null, null, null, 3]);
  });

  it("searches by name or email, matching % and _ literally, and continues from a cursor", async () => {
    signIn(true);
    mocks.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);
    const cursor = encodeAdminCursor({ name: "bola ade", id: OTHER });
    const response = await get(`?q=${encodeURIComponent(" 50%_off ")}&cursor=${cursor}`);
    expect(response.status).toBe(200);
    expect((await response.json()).meta.nextCursor).toBeNull();
    expect(mocks.query.mock.calls[0][1]).toEqual(["%50\\%\\_off%", "bola ade", OTHER, 26]);
  });

  it("rejects a bad limit, cursor or over-long search", async () => {
    signIn(true);
    expect((await get("?limit=0")).status).toBe(400);
    expect((await get("?limit=101")).status).toBe(400);
    expect((await get("?cursor=nope!")).status).toBe(400);
    expect((await get(`?q=${"x".repeat(101)}`)).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("refuses non-admins, including an admin previewing another access", async () => {
    signIn(false);
    expect((await get()).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("passes on the sign-in failure", async () => {
    mocks.requireApiAuth.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    expect((await get()).status).toBe(401);
  });
});

describe("POST /api/settings/admins", () => {
  beforeEach(() => {
    mocks.requireApiAuth.mockReset();
    mocks.managerQuery.mockReset();
  });

  it("creates the person, the admin membership and the phone, and writes the audit log", async () => {
    signIn(true);
    mocks.managerQuery
      .mockResolvedValueOnce([]) // no one has this email
      .mockResolvedValueOnce([{ id: 1 }]) // the first admin group
      .mockResolvedValueOnce([{ id: OTHER, full_name: "Ada Obi", email_address: "ada.obi@example.com" }])
      .mockResolvedValueOnce([]) // membership
      .mockResolvedValueOnce([]) // phone
      .mockResolvedValueOnce([{ group_name: "Collate Admins" }])
      .mockResolvedValueOnce([]); // audit log

    const response = await post(NEW_ADMIN);
    expect(response.status).toBe(201);
    expect((await response.json()).data).toEqual({
      personId: OTHER,
      fullName: "Ada Obi",
      email: "ad***@example.com",
      phone: "masked:+2348031234567",
      groups: ["Collate Admins"],
      isYou: false,
    });

    const calls = mocks.managerQuery.mock.calls.map(([sql, params]) => [String(sql), params]);
    expect(calls[0][1]).toEqual(["ada.obi@example.com"]);
    expect(calls[2][0]).toContain("INSERT INTO person");
    expect(calls[2][1]).toEqual(["Ada Obi", "ada.obi@example.com"]);
    expect(calls[3][0]).toContain("INSERT INTO membership");
    expect(calls[3][1]).toEqual([OTHER, 1]);
    expect(calls[4][0]).toContain("INSERT INTO phone_number");
    expect(calls[4][1]).toEqual([OTHER, "+2348031234567"]);
    expect(calls[6][0]).toContain("settings.admin.created");
    expect(calls[6][1]).toEqual([ME, OTHER, "unknown"]);
  });

  it("skips the phone when none is given", async () => {
    signIn(true);
    mocks.managerQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: OTHER, full_name: "Ada Obi", email_address: "ada.obi@example.com" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ group_name: "Collate Admins" }])
      .mockResolvedValueOnce([]);
    const response = await post({ fullName: "Ada Obi", email: "ada.obi@example.com" });
    expect(response.status).toBe(201);
    expect(mocks.managerQuery.mock.calls.some(([sql]) => String(sql).includes("phone_number"))).toBe(false);
  });

  it("says the admin already exists, without reusing the person", async () => {
    signIn(true);
    mocks.managerQuery.mockResolvedValueOnce([{ id: OTHER, is_admin: true }]);
    const response = await post(NEW_ADMIN);
    expect(response.status).toBe(409);
    expect((await response.json()).error.message).toBe("This admin already exists");
    expect(mocks.managerQuery).toHaveBeenCalledTimes(1);
  });

  it("refuses an email that belongs to someone who is not an admin", async () => {
    signIn(true);
    mocks.managerQuery.mockResolvedValueOnce([{ id: OTHER, is_admin: false }]);
    const response = await post(NEW_ADMIN);
    expect(response.status).toBe(409);
    expect((await response.json()).error.message).toBe("This email already belongs to someone else");
  });

  it("turns a race on the unique email into 409, but not other unique errors", async () => {
    signIn(true);
    mocks.managerQuery.mockRejectedValueOnce(
      Object.assign(new Error("dup"), { driverError: { code: "23505", constraint: "uq_person_email_address_lower" } }),
    );
    expect((await post(NEW_ADMIN)).status).toBe(409);

    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.managerQuery.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "23505", constraint: "membership_pkey" }));
    expect((await post(NEW_ADMIN)).status).toBe(500);
    log.mockRestore();
  });

  it("rejects bad details and invalid JSON before touching the database", async () => {
    signIn(true);
    const response = await post({ fullName: "", email: "nope", phone: "0803" });
    expect(response.status).toBe(400);
    expect(Object.keys((await response.json()).error.fields).sort()).toEqual(["email", "fullName", "phone"]);
    expect((await post("{not json")).status).toBe(400);
    expect(mocks.managerQuery).not.toHaveBeenCalled();
  });

  it("refuses non-admins, admins using View as, and other origins", async () => {
    signIn(false);
    expect((await post(NEW_ADMIN)).status).toBe(403);
    signIn(true, { label: "Party", seatId: null });
    expect((await post(NEW_ADMIN)).status).toBe(403);
    expect((await post(NEW_ADMIN, "https://evil.example")).status).toBe(403);
    expect((await post(NEW_ADMIN, null)).status).toBe(403);
    expect(mocks.managerQuery).not.toHaveBeenCalled();
  });
});
