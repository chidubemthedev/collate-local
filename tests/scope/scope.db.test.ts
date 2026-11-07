/**
 * Who-can-see-what tests against the real route handlers, the real policy module and a real
 * Postgres loaded with the test fixture (`lib/db/seeds/test/fixture.ts`).
 *
 * Each test name starts with its ID in the manual test script (Google Sheet "Test cases" tab),
 * so a failure here points at the same row a tester would run by hand.
 *
 * This suite empties the database it runs against. It only runs when RUN_SCOPE_TESTS=true, and
 * the fixture refuses a database whose name does not contain "test".
 *
 *   RUN_SCOPE_TESTS=true npm run test:scope
 *
 * `it.fails` marks a known gap between the app and the spec: the test describes the spec and is
 * expected to fail today. When the gap is fixed it starts passing, Vitest reports it, and the
 * `.fails` should be removed.
 */
import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { session, ORIGIN, fx, get, loginAs, logout, send, setFixture } from "./harness";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (session.token && name.includes("collate_session") ? { value: session.token } : undefined),
  }),
}));

vi.setConfig({ hookTimeout: 60_000, testTimeout: 30_000 });

const shouldRun = process.env.RUN_SCOPE_TESTS === "true" && Boolean(process.env.DATABASE_URL);
process.env.SERVER_BASE_URL ??= ORIGIN;

interface Summary {
  totalPUs: number;
  coveredPUs: number;
  officialAgentPct: number;
  extraAgentsCount: number;
}
interface Candidate {
  name: string;
  office: string;
  seat: string;
  deputyName: string | null;
  totalPUs: number;
  coveredPUs: number;
  coveragePct: number;
  extraAgentsCount: number;
  isOffCycle: boolean;
}
interface Agent {
  fullName: string;
  agentKind: string;
  maskedPhone: string | null;
  owner: { displayName: string };
  pollingUnit: { inecPollingUnitCode: string };
}
interface Gaps {
  items: Array<{ code: string }>;
}

type Routes = {
  summary: typeof import("@/app/api/coverage/summary/route");
  candidates: typeof import("@/app/api/coverage/candidates/route");
  gaps: typeof import("@/app/api/coverage/gaps/route");
  agents: typeof import("@/app/api/agents/route");
  viewAs: typeof import("@/app/api/auth/view-as/route");
  broadcasts: typeof import("@/app/api/broadcasts/route");
  otpRequest: typeof import("@/app/api/auth/otp/request/route");
};
let routes: Routes;

async function summary(query = ""): Promise<Summary> {
  const result = await get<Summary>(routes.summary.GET, `/api/coverage/summary${query}`);
  expect(result.status).toBe(200);
  return result.body.data;
}

function figure(s: Summary): string {
  return `${s.coveredPUs} of ${s.totalPUs} (${s.officialAgentPct}%)`;
}

async function candidates(): Promise<Candidate[]> {
  const result = await get<Candidate[]>(routes.candidates.GET, "/api/coverage/candidates?limit=500");
  expect(result.status).toBe(200);
  return result.body.data;
}

async function agents(query = ""): Promise<Agent[]> {
  const result = await get<Agent[]>(routes.agents.GET, `/api/agents?limit=100${query}`);
  expect(result.status).toBe(200);
  return result.body.data;
}

async function gapCodes(query = ""): Promise<string[]> {
  const result = await get<Gaps>(routes.gaps.GET, `/api/coverage/gaps${query ? `?${query}` : ""}`);
  expect(result.status).toBe(200);
  return result.body.data.items.map((item) => item.code).sort();
}

/** Logs in as an admin and turns on "View as" for a candidate's seat. */
async function viewAsCandidate(candidate: "P10" | "P12" | "P14" | "P15" | "P16" | "P17" | "P18" | "P19"): Promise<void> {
  await loginAs("P01");
  const result = await send(routes.viewAs.PUT, "/api/auth/view-as", "PUT", {
    value: `seat:${fx().seatIds[candidate]}`,
  });
  expect(result.status).toBe(200);
}

/** Turns one visibility grant off for the duration of `run`. */
async function withGrantOff(viewer: string, owner: string, run: () => Promise<void>): Promise<void> {
  const { getDataSource } = await import("@/lib/db");
  const dataSource = await getDataSource();
  const grant = [fx().groupIds[viewer], fx().groupIds[owner]];
  const sql = `UPDATE group_visibility_grant SET is_allowed = $3 WHERE viewer_group_id = $1 AND owner_group_id = $2;`;
  await dataSource.query(sql, [...grant, false]);
  try {
    await run();
  } finally {
    await dataSource.query(sql, [...grant, true]);
  }
}

const code = {
  A: "24-10-01-001",
  B: "24-10-01-002",
  C: "24-10-02-001",
  D: "24-10-02-002",
  E: "24-12-03-001",
  F: "22-05-01-001",
  G: "04-17-03-012",
  H: "20-40-01-001",
};

describe.skipIf(!shouldRun)("scope: who can see what (test script fixture)", () => {
  beforeAll(async () => {
    const { assertTestDatabase, resetTestDatabase, seedTestFixture } = await import(
      "@/lib/db/seeds/test/fixture"
    );
    assertTestDatabase(process.env.DATABASE_URL);
    // Migrations run before the suite (npm run db:migrate); loading them here breaks under Vitest.
    (await import("@/lib/db/data-source")).default.setOptions({ logging: false, migrations: [] });
    const { getDataSource } = await import("@/lib/db");
    const dataSource = await getDataSource();
    await resetTestDatabase(dataSource);
    setFixture(await seedTestFixture(dataSource));

    routes = {
      summary: await import("@/app/api/coverage/summary/route"),
      candidates: await import("@/app/api/coverage/candidates/route"),
      gaps: await import("@/app/api/coverage/gaps/route"),
      agents: await import("@/app/api/agents/route"),
      viewAs: await import("@/app/api/auth/view-as/route"),
      broadcasts: await import("@/app/api/broadcasts/route"),
      otpRequest: await import("@/app/api/auth/otp/request/route"),
    };
  });

  afterAll(async () => {
    const { getDataSource } = await import("@/lib/db");
    await (await getDataSource()).destroy();
  });

  beforeEach(() => logout());

  describe("headline coverage", () => {
    it.each([
      ["HOME-05", "P01", "5 of 8 (63%)"],
      ["COV-18", "P03", "5 of 8 (63%)"],
      ["HOME-04", "P04", "3 of 5 (60%)"],
      ["HOME-03", "P05", "2 of 4 (50%)"],
      ["SEC-03", "P08", "3 of 5 (60%)"],
      ["SEC-04", "P09", "0 of 1 (0%)"],
    ] as const)("%s %s sees %s", async (_id, persona, expected) => {
      await loginAs(persona);
      expect(figure(await summary())).toBe(expected);
    });

    it("COV-03 P01 drills Lagos → Ikeja → wards", async () => {
      await loginAs("P01");
      const { stateIds, lgaIds, wardIds } = fx();
      expect(figure(await summary(`?stateId=${stateIds.Lagos}`))).toBe("3 of 5 (60%)");
      expect(figure(await summary(`?lgaId=${lgaIds.Ikeja}`))).toBe("2 of 4 (50%)");
      expect(figure(await summary(`?wardId=${wardIds["Ikeja Ward 01"]}`))).toBe("1 of 2 (50%)");
      expect(figure(await summary(`?wardId=${wardIds["Ikeja Ward 02"]}`))).toBe("1 of 2 (50%)");
    });

    it("COV-04 P01 drills political units: Lagos West → Ikeja → Ikeja I", async () => {
      await loginAs("P01");
      const units = fx().politicalUnitIds;
      expect(figure(await summary(`?politicalUnitId=${units["SD Lagos West"]}`))).toBe("2 of 4 (50%)");
      expect(figure(await summary(`?politicalUnitId=${units["FC Ikeja"]}`))).toBe("2 of 4 (50%)");
      expect(figure(await summary(`?politicalUnitId=${units["SC Ikeja I"]}`))).toBe("1 of 2 (50%)");
    });

    it("COV-14 extra agents never change headline coverage", async () => {
      await loginAs("P05");
      const before = await summary();
      expect(before.extraAgentsCount).toBe(2);
      expect(figure(before)).toBe("2 of 4 (50%)");
    });

    it.each([
      ["COV-19", "P12", "3 of 5 (60%)"],
      ["COV-20", "P17", "1 of 2 (50%)"],
      ["NAV-04", "P16", "2 of 4 (50%)"],
      ["SEC-04", "P14", "0 of 1 (0%)"],
    ] as const)("%s viewing as %s shows %s", async (_id, candidate, expected) => {
      await viewAsCandidate(candidate);
      expect(figure(await summary())).toBe(expected);
    });
  });

  describe("gaps", () => {
    it("COV-07 P05 sees only PU-B and PU-D without an agent", async () => {
      await loginAs("P05");
      expect(await gapCodes()).toEqual([code.B, code.D]);
    });

    it("COV-20 viewing as P17 lists only PU-B (Ikeja II is out of scope)", async () => {
      await viewAsCandidate("P17");
      expect(await gapCodes()).toEqual([code.B]);
    });

    it("SEC-01 P04 never sees gaps outside Lagos", async () => {
      await loginAs("P04");
      expect(await gapCodes()).toEqual([code.B, code.D]);
    });
  });

  describe("candidates page", () => {
    it("CAND-02 seat names and CAND-04 running mates", async () => {
      await loginAs("P01");
      const rows = await candidates();
      const byName = Object.fromEntries(rows.map((row) => [row.name, row]));
      expect(byName["Jide President"]?.seat).toBe("Nigeria");
      expect(byName["Lola Governor"]?.seat).toBe("Lagos");
      expect(byName["Sani TudunWada"]?.seat).toBe("Tudun Wada");
      expect(byName["Jide President"]?.deputyName).toBe("Kemi VicePres");
      expect(byName["Lola Governor"]?.deputyName).toBe("Musa DepGov");
      // Running mates have no coverage row of their own.
      expect(byName["Kemi VicePres"]).toBeUndefined();
      expect(byName["Musa DepGov"]).toBeUndefined();
    });

    it("COV-05 each candidate's seat coverage", async () => {
      await loginAs("P01");
      const rows = await candidates();
      const coverage = Object.fromEntries(rows.map((row) => [row.name, `${row.coveredPUs} of ${row.totalPUs}`]));
      expect(coverage).toEqual({
        "Jide President": "5 of 8",
        "Lola Governor": "3 of 5",
        "Nafisa KanoGov": "0 of 1",
        "Obi Senate": "2 of 4",
        "Peju Reps": "2 of 4",
        "Ray AnambraReps": "1 of 1",
        "Queen Assembly": "1 of 2",
        "Sani TudunWada": "0 of 1",
      });
    });

    it("CAND-06 P16 has +1 extra agent of their own", async () => {
      await loginAs("P04");
      const rows = await candidates();
      expect(rows.find((row) => row.name === "Peju Reps")?.extraAgentsCount).toBe(1);
    });

    it("CAND-08 viewing as P16 lists their own seat and the Assembly seat inside it", async () => {
      await viewAsCandidate("P16");
      const names = (await candidates()).map((row) => row.name);
      expect(names).toEqual(expect.arrayContaining(["Peju Reps", "Queen Assembly"]));
      for (const outside of ["Jide President", "Lola Governor", "Ray AnambraReps", "Sani TudunWada"]) {
        expect(names).not.toContain(outside);
      }
    });

    it.each([
      ["CAND-09", "P12", ["Lola Governor", "Obi Senate", "Peju Reps", "Queen Assembly"]],
      ["SEC-04", "P14", ["Nafisa KanoGov", "Sani TudunWada"]],
    ] as const)("%s viewing as %s lists only seats at or below theirs", async (_id, candidate, expected) => {
      await viewAsCandidate(candidate);
      expect((await candidates()).map((row) => row.name).sort()).toEqual([...expected].sort());
    });

    it("SEC-01 P04 (Lagos) never sees the President, Kano or Anambra candidates", async () => {
      await loginAs("P04");
      expect((await candidates()).map((row) => row.name).sort()).toEqual(
        ["Lola Governor", "Obi Senate", "Peju Reps", "Queen Assembly"],
      );
    });
  });

  describe("agents", () => {
    it("AGT-01 P05 sees the four Ikeja agents, official first per PU", async () => {
      await loginAs("P05");
      const rows = await agents();
      expect(rows.map((row) => row.fullName).sort()).toEqual(
        ["Tunde Agent", "Uche Extra", "Victor TwoPhones", "Zainab Obedient Agent"],
      );
      const atA = rows.filter((row) => row.pollingUnit.inecPollingUnitCode === code.A);
      expect(atA.map((row) => row.agentKind).sort()).toEqual(["extra", "extra", "official"]);
    });

    it("AGT-05 phone numbers are masked in the response body", async () => {
      await loginAs("P04");
      const result = await get<Agent[]>(routes.agents.GET, "/api/agents?limit=100");
      expect(result.status).toBe(200);
      for (const number of ["+2348000000020", "2348000000020", "08000000020", "+2348000000022"]) {
        expect(result.raw).not.toContain(number);
      }
      expect(result.body.data.every((row) => row.maskedPhone === null || row.maskedPhone.includes("*"))).toBe(true);
    });

    it("AGT-07 viewing as P16 shows only Ikeja agents", async () => {
      await viewAsCandidate("P16");
      const names = (await agents()).map((row) => row.fullName);
      expect(names).not.toContain("Xenia SMSOnly");
      expect(names).not.toContain("Fixture Agent F");
      expect(names.sort()).toEqual(["Tunde Agent", "Uche Extra", "Victor TwoPhones", "Zainab Obedient Agent"]);
    });

    it("SEC-02 viewing as P17 never returns agents outside Ikeja I", async () => {
      await viewAsCandidate("P17");
      const names = (await agents()).map((row) => row.fullName);
      expect(names.sort()).toEqual(["Tunde Agent", "Uche Extra", "Zainab Obedient Agent"]);
      expect((await agents("&q=Victor")).length).toBe(0);
      expect((await agents("&q=Xenia")).length).toBe(0);
    });

    it("SEC-03 P08 (Obedient, Lagos) sees all groups' agents in Lagos and nothing outside", async () => {
      await loginAs("P08");
      const rows = await agents();
      expect(rows.map((row) => row.fullName).sort()).toEqual(
        ["Tunde Agent", "Uche Extra", "Victor TwoPhones", "Xenia SMSOnly", "Zainab Obedient Agent"],
      );
    });

    it("SEC-04 P09 (Kano) sees no agents", async () => {
      await loginAs("P09");
      expect(await agents()).toEqual([]);
    });

    it("ADM-07 P03 sees agents of every group nationally (allow-all grants)", async () => {
      await loginAs("P03");
      expect((await agents()).length).toBe(7);
    });

    it("ADM-08 turning a visibility grant off hides that group's agents (state-level viewer)", async () => {
      await withGrantOff("NDC Lagos", "Obedient Movement Lagos", async () => {
        await loginAs("P04");
        expect((await agents()).map((row) => row.fullName)).not.toContain("Zainab Obedient Agent");
        await loginAs("P08");
        expect((await agents()).map((row) => row.fullName)).toContain("Zainab Obedient Agent");
      });
    });
  });

  describe("broadcast audiences", () => {
    async function preview(persona: "P04" | "P16" | "P17", filter: Record<string, unknown>) {
      const { previewAudience } = await import("@/lib/policy/core/audience");
      const { loadPolicyUser } = await import("@/lib/policy/core/policy-user");
      const { getDataSource } = await import("@/lib/db");
      const manager = (await getDataSource()).manager;
      return previewAudience(await loadPolicyUser(fx().personIds[persona], manager), filter, manager);
    }

    it("MSG-03 P04 → all agents in Ikeja: 2 official, 2 extra", async () => {
      expect(await preview("P04", { lgaId: fx().lgaIds.Ikeja })).toEqual({ officialCount: 2, extraCount: 2 });
    });

    it("MSG-06 a candidate cannot filter by LGA", async () => {
      const { InvalidFilterError } = await import("@/lib/policy/errors");
      await expect(preview("P16", { lgaId: fx().lgaIds.Ikeja })).rejects.toBeInstanceOf(InvalidFilterError);
    });

    it("MSG-12 P17 reaches everyone at PU-A, whoever owns them", async () => {
      expect(await preview("P17", { pollingUnitId: fx().pollingUnitIds["PU-A"] })).toEqual({
        officialCount: 1,
        extraCount: 2,
      });
    });

    it("MSG-15 P16 cannot reach agents outside their seat", async () => {
      expect(await preview("P16", { stateId: fx().stateIds.Kano })).toEqual({ officialCount: 0, extraCount: 0 });
      expect(await preview("P16", { pollingUnitId: fx().pollingUnitIds["PU-E"] })).toEqual({
        officialCount: 0,
        extraCount: 0,
      });
    });
  });

  describe("view as", () => {
    it("NAV-06 an admin cannot send a broadcast while viewing as someone", async () => {
      await viewAsCandidate("P16");
      const result = await send(routes.broadcasts.POST, "/api/broadcasts", "POST", {
        messageText: "test",
        audienceFilter: {},
      });
      expect(result.status).toBe(403);
    });

    it("NAV-07 P04 cannot view as a candidate outside Lagos", async () => {
      await loginAs("P04");
      const result = await send(routes.viewAs.PUT, "/api/auth/view-as", "PUT", {
        value: `seat:${fx().seatIds.P14}`,
      });
      expect(result.status).toBe(403);
    });

    it("NAV-07 P04 can view as the Lagos governorship candidate", async () => {
      await loginAs("P04");
      const result = await send(routes.viewAs.PUT, "/api/auth/view-as", "PUT", {
        value: `seat:${fx().seatIds.P12}`,
      });
      expect(result.status).toBe(200);
    });
  });

  describe("known gaps (spec says otherwise; remove .fails when fixed)", () => {
    // PRD §8: login must not reveal whether an email is registered. Today an unknown email
    // gets 404 not_found while a known one gets 200.
    it.fails("ONB-13 an unknown email gets the same answer as a registered one", async () => {
      const known = await send(routes.otpRequest.POST, "/api/auth/otp/request", "POST", {
        email: fx().emails.P04,
      });
      const unknown = await send(routes.otpRequest.POST, "/api/auth/otp/request", "POST", {
        email: "nobody@fixture.collate.test",
      });
      expect(unknown.status).toBe(known.status);
    });

    // ARCH §4 worked example: turning off "NDC national → Obi campaign" hides those agents from
    // NDC national users. Today national party accounts skip visibility grants entirely
    // (lib/policy/core/owners.ts), so the grant has no effect on them.
    it.fails("ADM-08 a grant turned off also applies to national party users", async () => {
      await withGrantOff("NDC", "Obedient Movement Lagos", async () => {
        await loginAs("P03");
        expect((await agents()).map((row) => row.fullName)).not.toContain("Zainab Obedient Agent");
      });
    });

    // PRD §4.2: a candidate sees offices below their own, never above. "Within" is decided by
    // polling units only, so a seat higher up whose area happens to equal the candidate's
    // (here Senate Lagos West = Reps Ikeja, both PU-A…PU-D) is shown as if it were below.
    it.fails("CAND-08 viewing as P16 never lists a higher office with the same area", async () => {
      await viewAsCandidate("P16");
      expect((await candidates()).map((row) => row.name)).not.toContain("Obi Senate");
    });

    // PRD §6.6: candidates use the app through their own access link. Access links are not
    // built yet, and a candidate who signs in has no membership, so every API refuses them.
    it.fails("LINK-02 a candidate signed in sees their own seat", async () => {
      await loginAs("P12");
      expect(figure(await summary())).toBe("3 of 5 (60%)");
    });
  });
});
