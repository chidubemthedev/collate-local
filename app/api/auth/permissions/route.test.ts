import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireApiAuth: vi.fn(), query: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth/api", () => ({ requireApiAuth: mocks.requireApiAuth }));

import { GET } from "./route";

function signIn(context: Record<string, unknown>) {
  mocks.requireApiAuth.mockResolvedValue({
    ok: true,
    context: {
      dataSource: { query: mocks.query },
      isAdmin: false,
      canManageCoverage: true,
      hasGlobalCoverageAccess: false,
      scopes: [],
      roles: [],
      ownLabel: "Collate Admins",
      viewAs: null,
      ...context,
    },
  });
}

describe("GET /api/auth/permissions", () => {
  beforeEach(() => {
    mocks.requireApiAuth.mockReset();
    mocks.query.mockReset();
  });

  it("returns the view, read-only and the area the previewed access lies in", async () => {
    signIn({
      roles: [{ name: "Candidate · Governor, Anambra", type: "view_as" }],
      scopes: [{ stateId: null, lgaId: null, wardId: null, politicalUnitId: 155 }],
      viewAs: { label: "Candidate · Governor, Anambra", seatId: 6 },
    });
    mocks.query.mockResolvedValue([{ states: "1", state_code: "04", lgas: "21", lga_code: "04-01", wards: "300", ward_code: "x" }]);

    const response = await GET();
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.permissions).toMatchObject({
      roles: ["Candidate · Governor, Anambra"],
      ownAccess: "Collate Admins",
      viewAs: "Candidate · Governor, Anambra",
      readOnly: true,
      homeArea: { stateCode: "04", lgaCode: null, wardCode: null },
    });
  });

  it("opens on the LGA when the access lies inside one LGA", async () => {
    signIn({ scopes: [{ stateId: null, lgaId: 17, wardId: null, politicalUnitId: null }] });
    mocks.query.mockResolvedValue([{ states: "1", state_code: "04", lgas: "1", lga_code: "04-17", wards: "7", ward_code: "x" }]);
    const { data } = await (await GET()).json();
    expect(data.permissions.homeArea).toEqual({ stateCode: "04", lgaCode: "04-17", wardCode: null });
  });

  it("has no home area (all of Nigeria) for national access", async () => {
    signIn({ isAdmin: true, hasGlobalCoverageAccess: true, roles: [{ name: "Collate Admins", type: "admin" }] });
    const { data } = await (await GET()).json();
    expect(data.permissions).toMatchObject({ viewAs: null, readOnly: false, homeArea: null });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
