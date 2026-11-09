import { describe, expect, it, vi } from "vitest";
import {
  candidateAccess,
  chooseViewAs,
  effectiveAccess,
  listViewAsOptions,
  loadHomeArea,
  ownAccessFromRows,
  policyUserForView,
  runningMateTitle,
  seatLabel,
  titleCaseName,
  type OwnAccess,
  type Queryable,
} from "./view-as";

const ADMIN: OwnAccess = { isAdmin: true, hasGlobalCoverageAccess: true, scopes: [] };
const PARTY: OwnAccess = { isAdmin: false, hasGlobalCoverageAccess: true, scopes: [] };
const STATE_LEAD: OwnAccess = {
  isAdmin: false,
  hasGlobalCoverageAccess: false,
  scopes: [{ stateId: 5, lgaId: null, wardId: null, politicalUnitId: null }],
};

const SEATS = [
  { seat_id: 1, office_name: "President", unit_id: 1, unit_name: "NIGERIA", unit_type: "country", state_name: null },
  { seat_id: 6, office_name: "Governor", unit_id: 155, unit_name: "ANAMBRA", unit_type: "state", state_name: "ANAMBRA" },
  { seat_id: 7, office_name: "Governor", unit_id: 156, unit_name: "LAGOS", unit_type: "state", state_name: "LAGOS" },
  {
    seat_id: 40,
    office_name: "Senate",
    unit_id: 300,
    unit_name: "ANAMBRA NORTH",
    unit_type: "senatorial_district",
    state_name: "ANAMBRA",
  },
  {
    seat_id: 90,
    office_name: "House of Reps",
    unit_id: 500,
    unit_name: "ONITSHA NORTH/ONITSHA SOUTH",
    unit_type: "federal_constituency",
    state_name: "ANAMBRA",
  },
];

function database(rows: unknown[] = SEATS) {
  const query = vi.fn(async (sql: string, parameters?: unknown[]) => {
    void sql;
    void parameters;
    return rows;
  });
  // Typed as the generic query (so it can be passed as a Queryable) and as the mock (for its calls).
  return { query: query as unknown as Queryable["query"] & typeof query };
}

describe("candidateAccess", () => {
  const seat = { seat_id: 9, office_name: "Governor", unit_id: 32, unit_name: "BAUCHI", unit_type: "state" };

  it("limits a candidate to their seat's area", () => {
    expect(candidateAccess({ ...seat, is_running_mate: false })).toEqual({
      own: {
        isAdmin: false,
        hasGlobalCoverageAccess: false,
        scopes: [{ stateId: null, lgaId: null, wardId: null, politicalUnitId: 32 }],
      },
      label: "Candidate · Governor, Bauchi",
    });
  });

  it("gives a running mate the same seat under their own title", () => {
    expect(candidateAccess({ ...seat, is_running_mate: true }).label).toBe("Candidate · Deputy Governor, Bauchi");
    const vp = candidateAccess({
      seat_id: 1,
      office_name: "President",
      unit_id: 1,
      unit_name: "NIGERIA",
      unit_type: "country",
      is_running_mate: true,
    });
    expect(vp.label).toBe("Candidate · Vice President");
    expect(vp.own).toEqual({ isAdmin: false, hasGlobalCoverageAccess: true, scopes: [] });
  });

  it("names running mates by office", () => {
    expect(runningMateTitle("President")).toBe("Vice President");
    expect(runningMateTitle("Governor")).toBe("Deputy Governor");
    expect(runningMateTitle("Senate")).toBe("Running mate, Senate");
  });
});

describe("labels", () => {
  it("title-cases INEC names and keeps FCT", () => {
    expect(titleCaseName("ONITSHA NORTH/ONITSHA SOUTH")).toBe("Onitsha North/Onitsha South");
    expect(titleCaseName("FCT")).toBe("FCT");
  });

  it("names seats as in the dropdown", () => {
    expect(seatLabel("President", "NIGERIA")).toBe("Candidate · President");
    expect(seatLabel("Senate", "ANAMBRA NORTH")).toBe("Candidate · Senate, Anambra North");
  });

  it("labels the person's own access with their group names", () => {
    const campaign = { group_name: "Campaign HQ", group_type: "campaign", can_message: "agents_they_cover", sees_coverage: "own_area" };
    const { own, label, canMessage } = ownAccessFromRows([
      { ...campaign, scope_state_id: 5, scope_lga_id: null, scope_ward_id: null, scope_political_unit_id: null },
      { ...campaign, scope_state_id: null, scope_lga_id: 9, scope_ward_id: null, scope_political_unit_id: null },
    ]);
    expect(label).toBe("Campaign HQ");
    expect(own.hasGlobalCoverageAccess).toBe(false);
    expect(own.scopes).toHaveLength(2);
    expect(canMessage).toBe(true);
  });

  it("takes coverage and messaging from the group type's rules", () => {
    const area = { scope_state_id: 5, scope_lga_id: null, scope_ward_id: null, scope_political_unit_id: null };
    // A Party-type group sees the whole country, even with an area set.
    const party = ownAccessFromRows([
      { group_name: "NDC", group_type: "party", can_message: "agents_they_cover", sees_coverage: "national", ...area },
    ]);
    expect(party.own.hasGlobalCoverageAccess).toBe(true);
    expect(party.canMessage).toBe(true);
    // A support group looks at its own area and cannot message.
    const support = ownAccessFromRows([
      { group_name: "Youth Wing", group_type: "support_group", can_message: "none", sees_coverage: "own_area", ...area },
    ]);
    expect(support.own.hasGlobalCoverageAccess).toBe(false);
    expect(support.own.scopes).toEqual([{ stateId: 5, lgaId: null, wardId: null, politicalUnitId: null }]);
    expect(support.canMessage).toBe(false);
    // A type an admin made (no key) still counts as a membership.
    const custom = ownAccessFromRows([
      { group_name: "Observers", group_type: null, can_message: "none", sees_coverage: "national", ...area },
    ]);
    expect(custom.own.hasGlobalCoverageAccess).toBe(true);
    expect(custom.label).toBe("Observers");
  });
});

describe("listViewAsOptions", () => {
  it("gives an admin Admin, Party and President, then every seat under its office heading", async () => {
    const { self, groups } = await listViewAsOptions(database(), ADMIN, "Collate Admins");
    expect(self).toEqual({ value: "admin", label: "Admin" });
    expect(groups[0]).toEqual({
      heading: null,
      options: [
        { value: "admin", label: "Admin" },
        { value: "party", label: "Party · National" },
        { value: "seat:1", label: "Candidate · President" },
      ],
    });
    expect(groups.slice(1).map((group) => [group.heading, group.options.length])).toEqual([
      ["Candidate · Governor", 2],
      ["Candidate · Senate", 1],
      ["Candidate · House of Reps", 1],
    ]);
    expect(groups[3].options[0]).toEqual({ value: "seat:90", label: "Onitsha North/Onitsha South" });
  });

  it("groups Senate, Reps and Assembly seats by state, and leaves Governor as a list of states", async () => {
    const rows = [
      ...SEATS,
      { seat_id: 41, office_name: "Senate", unit_id: 301, unit_name: "LAGOS EAST", unit_type: "senatorial_district", state_name: "LAGOS" },
      { seat_id: 42, office_name: "Senate", unit_id: 302, unit_name: "ANAMBRA CENTRAL", unit_type: "senatorial_district", state_name: "ANAMBRA" },
    ];
    const { groups } = await listViewAsOptions(database(rows), ADMIN, "Collate Admins");
    const governor = groups.find((group) => group.heading === "Candidate · Governor")!;
    expect(governor.states).toBeUndefined();
    const senate = groups.find((group) => group.heading === "Candidate · Senate")!;
    expect(senate.options).toHaveLength(3);
    expect(senate.states).toEqual([
      {
        name: "Anambra",
        options: [
          { value: "seat:42", label: "Anambra Central" },
          { value: "seat:40", label: "Anambra North" },
        ],
      },
      { name: "Lagos", options: [{ value: "seat:41", label: "Lagos East" }] },
    ]);
  });

  it("reads each seat's state from its own unit (Governor) or its parent", async () => {
    const db = database();
    await listViewAsOptions(db, ADMIN, "Collate Admins");
    const [sql] = db.query.mock.calls[0];
    expect(sql).toContain("LEFT JOIN political_unit parent ON parent.id = pun.parent_political_unit_id");
    expect(sql).toContain("END AS state_name");
  });

  it("gives a party account no Admin option", async () => {
    const { self, groups } = await listViewAsOptions(database(), PARTY, "NDC National");
    expect(self.value).toBe("party");
    expect(groups.flatMap((group) => group.options).some((option) => option.value === "admin")).toBe(false);
  });

  it("starts an area-limited list with the person's own access and only checks seats in their area", async () => {
    const db = database(SEATS.slice(1, 2));
    const { self, groups } = await listViewAsOptions(db, STATE_LEAD, "Campaign HQ");
    expect(self).toEqual({ value: "self", label: "Campaign HQ" });
    expect(groups[0]).toEqual({ heading: null, options: [self] });
    expect(groups.flatMap((group) => group.options).some((option) => option.value === "party")).toBe(false);
    const [sql, parameters] = db.query.mock.calls[0];
    expect(sql).toContain("WITH own_units");
    expect(sql).toContain("l.state_id = ANY($1::int[])");
    expect(parameters).toEqual([[5]]);
  });

  it("lists nothing below for an area-limited person without areas", async () => {
    const db = database();
    const { groups } = await listViewAsOptions(db, { ...STATE_LEAD, scopes: [] }, "Campaign HQ");
    expect(groups).toHaveLength(1);
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe("chooseViewAs", () => {
  it("treats picking your own access as exiting", async () => {
    expect(await chooseViewAs(database(), ADMIN, "admin")).toBeNull();
    expect(await chooseViewAs(database(), STATE_LEAD, "self")).toBeNull();
  });

  it("only lets national access pick Party · National or Admin", async () => {
    expect(await chooseViewAs(database(), ADMIN, "party")).toEqual({ kind: "party" });
    expect(await chooseViewAs(database(), PARTY, "admin")).toBe("forbidden");
    expect(await chooseViewAs(database(), STATE_LEAD, "party")).toBe("forbidden");
    expect(await chooseViewAs(database(), ADMIN, "anything")).toBe("forbidden");
  });

  it("stores a seat inside the person's access, and refuses one outside", async () => {
    expect(await chooseViewAs(database([SEATS[1]]), STATE_LEAD, "seat:6")).toEqual({
      kind: "seat",
      seatId: 6,
      unitId: 155,
      unitType: "state",
      label: "Candidate · Governor, Anambra",
    });
    expect(await chooseViewAs(database([]), STATE_LEAD, "seat:7")).toBe("forbidden");
  });
});

describe("effectiveAccess", () => {
  const governor = { kind: "seat", seatId: 6, unitId: 155, unitType: "state", label: "Candidate · Governor, Anambra" };

  it("narrows to the seat's political unit, without a lookup for national access", async () => {
    const db = database();
    expect(await effectiveAccess(db, ADMIN, governor)).toEqual({
      label: "Candidate · Governor, Anambra",
      hasGlobalCoverageAccess: false,
      scopes: [{ stateId: null, lgaId: null, wardId: null, politicalUnitId: 155 }],
      seatId: 6,
    });
    expect(db.query).not.toHaveBeenCalled();
  });

  it("gives the President's view the whole country", async () => {
    const president = { kind: "seat", seatId: 1, unitId: 1, unitType: "country", label: "Candidate · President" };
    expect(await effectiveAccess(database(), ADMIN, president)).toMatchObject({ hasGlobalCoverageAccess: true, scopes: [] });
  });

  it("ends a view the person's own access no longer covers", async () => {
    expect(await effectiveAccess(database([]), STATE_LEAD, governor)).toBeNull();
    expect(await effectiveAccess(database(), STATE_LEAD, { kind: "party" })).toBeNull();
    expect(await effectiveAccess(database(), ADMIN, { kind: "nonsense" })).toBeNull();
    expect(await effectiveAccess(database(), ADMIN, null)).toBeNull();
  });
});

describe("loadHomeArea", () => {
  const area = (rows: unknown[]) => database(rows);

  it("is null for national access, without a lookup", async () => {
    const db = area([]);
    expect(await loadHomeArea(db, { hasGlobalCoverageAccess: true, scopes: [] })).toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });

  it("gives the state of a seat inside one state, and the LGA when it is inside one LGA", async () => {
    const seat = { hasGlobalCoverageAccess: false, scopes: [{ stateId: null, lgaId: null, wardId: null, politicalUnitId: 155 }] };
    expect(
      await loadHomeArea(area([{ states: "1", state_code: "04", lgas: "7", lga_code: "04-02", wards: "60", ward_code: "x" }]), seat),
    ).toEqual({ stateCode: "04", lgaCode: null, wardCode: null });
    const db = area([{ states: "1", state_code: "04", lgas: "1", lga_code: "04-17", wards: "7", ward_code: "x" }]);
    expect(await loadHomeArea(db, seat)).toEqual({ stateCode: "04", lgaCode: "04-17", wardCode: null });
    expect(db.query.mock.calls[0][0]).toContain("ppu.political_unit_id = ANY($1::int[])");
    expect(db.query.mock.calls[0][1]).toEqual([[155]]);
  });

  it("is null when the access spans several states", async () => {
    const scopes = [{ stateId: 4, lgaId: null, wardId: null, politicalUnitId: null }, { stateId: 5, lgaId: null, wardId: null, politicalUnitId: null }];
    expect(
      await loadHomeArea(area([{ states: "2", state_code: "04", lgas: "40", lga_code: "x", wards: "400", ward_code: "x" }]), {
        hasGlobalCoverageAccess: false,
        scopes,
      }),
    ).toBeNull();
  });
});

describe("policyUserForView", () => {
  it("uses the seat and its candidate, never admin rights", async () => {
    const user = await policyUserForView(database([{ id: 12 }]), "person-1", {
      label: "x",
      hasGlobalCoverageAccess: false,
      scopes: [],
      seatId: 6,
    });
    expect(user).toMatchObject({ personId: "person-1", isAdmin: false, seatId: 6, candidateId: 12, groupIds: [] });
  });

  it("gives Party · National what a party account gets (national, no admin rights)", async () => {
    const db = database();
    const user = await policyUserForView(db, "person-1", { label: "x", hasGlobalCoverageAccess: true, scopes: [], seatId: null });
    expect(user).toMatchObject({ isAdmin: false, hasNationalAccess: true, seatId: null, candidateId: null });
    expect(db.query).not.toHaveBeenCalled();
  });
});
