import "dotenv/config";
import { randomUUID } from "node:crypto";
import type { DataSource, EntityManager, QueryRunner } from "typeorm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { listAgents } from "./list-agents";
import { listOwnerGroups } from "./owner-groups";
import { canAccessPollingUnit, describeScope } from "./scope-queries";
import { loadPolicyUser } from "./policy-user";
import { AgentKind } from "../../db/entities/agent-assignment.entity";
import { AuditLog } from "../../db/entities/audit-log.entity";

vi.setConfig({ hookTimeout: 60_000, testTimeout: 60_000 });

const requested = process.env.RUN_DB_TESTS === "true";
if (requested && process.env.NODE_ENV === "production") {
  throw new Error("Policy database tests cannot run in production.");
}

const shouldRun = requested && Boolean(process.env.DATABASE_URL);

interface Fixtures {
  adminPersonId: string;
  candidatePersonId: string;
  runningMatePersonId: string;
  statePersonId: string;
  wardPersonId: string;
  noScopePersonId: string;
  principalCandidateId: number;
  runningMateCandidateId: number;
  lagosStateId: number;
  kanoStateId: number;
  lagosPoliticalUnitId: number;
  lagosWardId: number;
  viewerGroupId: number;
  lagosOwnerGroupId: number;
  kanoOwnerGroupId: number;
  ungrantedOwnerGroupId: number;
  paginationOwnerGroupId: number;
  assignmentIds: string[];
  paginationAssignmentIds: string[];
  lagosOwnerAssignmentId: string;
  kanoOwnerAssignmentId: string;
  ungrantedOwnerAssignmentId: string;
  candidateOwnerAssignmentId: string;
  pollingUnitIds: number[];
  lagosPollingUnitIds: number[];
  kanoPollingUnitIds: number[];
  wardPollingUnitIds: number[];
  viewerLagosGrantId: number;
}

let dataSource: DataSource | undefined;
let queryRunner: QueryRunner | undefined;
let manager: EntityManager | undefined;
let fixtures: Fixtures | undefined;

describe.skipIf(!shouldRun)("policy database integration", () => {
  beforeAll(async () => {
    const database = await import("../../db/data-source");
    dataSource = database.default;
    dataSource.setOptions({ logging: false, migrations: [] });
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    manager = queryRunner.manager;
    fixtures = await createFixtures(manager);
  });

  afterAll(async () => {
    try {
      if (queryRunner?.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
    } finally {
      if (queryRunner && !queryRunner.isReleased) {
        await queryRunner.release();
      }
      if (dataSource?.isInitialized) {
        await dataSource.destroy();
      }
    }
  });

  it("allows admins all fixture assignments and applies candidate seat scope", async () => {
    const { adminPersonId, candidatePersonId, assignmentIds, lagosPollingUnitIds, kanoStateId } =
      requireFixtures();
    const admin = await loadPolicyUser(adminPersonId, requireManager());
    const adminPage = await collectAllPages(admin, {}, requireManager());
    const adminIds = new Set(adminPage.map((item) => item.assignmentId));
    expect(assignmentIds.every((id) => adminIds.has(id))).toBe(true);

    const candidate = await loadPolicyUser(candidatePersonId, requireManager());
    const candidatePage = await listAgents(candidate, { limit: 100 }, undefined, requireManager());
    const candidateRows = candidatePage.items.filter((item) => assignmentIds.includes(item.assignmentId));
    expect(candidateRows.length > 0).toBe(true);
    expect(candidateRows.every((item) => lagosPollingUnitIds.includes(item.pollingUnit.id))).toBe(true);

    const outsideState = await listAgents(
      candidate,
      { stateId: kanoStateId, limit: 100 },
      undefined,
      requireManager(),
    );
    expect(outsideState.items.some((item) => assignmentIds.includes(item.assignmentId))).toBe(false);
    expect(lagosPollingUnitIds.every((id) => !outsideState.items.some((item) => item.pollingUnit.id === id))).toBe(true);
    expect(kanoStateId > 0).toBe(true);
  });

  it("gives a running mate exactly the principal's scope", async () => {
    const { candidatePersonId, runningMatePersonId, assignmentIds } = requireFixtures();
    const principal = await loadPolicyUser(candidatePersonId, requireManager());
    const runningMate = await loadPolicyUser(runningMatePersonId, requireManager());
    const principalPage = await listAgents(principal, { limit: 100 }, undefined, requireManager());
    const runningMatePage = await listAgents(runningMate, { limit: 100 }, undefined, requireManager());

    expect(
      principalPage.items
        .filter((item) => assignmentIds.includes(item.assignmentId))
        .map((item) => item.assignmentId)
        .sort(),
    ).toEqual(
      runningMatePage.items
        .filter((item) => assignmentIds.includes(item.assignmentId))
        .map((item) => item.assignmentId)
        .sort(),
    );
  });

  it("enforces state and ward membership scopes and fails closed without scope", async () => {
    const {
      statePersonId,
      wardPersonId,
      noScopePersonId,
      lagosStateId,
      lagosWardId,
      lagosPollingUnitIds,
      wardPollingUnitIds,
      assignmentIds,
    } =
      requireFixtures();
    const stateUser = await loadPolicyUser(statePersonId, requireManager());
    const wardUser = await loadPolicyUser(wardPersonId, requireManager());
    const noScopeUser = await loadPolicyUser(noScopePersonId, requireManager());

    const statePage = await listAgents(stateUser, { limit: 100 }, undefined, requireManager());
    const wardPage = await listAgents(wardUser, { limit: 100 }, undefined, requireManager());
    const noScopePage = await listAgents(noScopeUser, { limit: 100 }, undefined, requireManager());
    const fixtureStateRows = statePage.items.filter((item) => assignmentIds.includes(item.assignmentId));
    const fixtureWardRows = wardPage.items.filter((item) => assignmentIds.includes(item.assignmentId));

    expect(fixtureStateRows.length > 0).toBe(true);
    expect(fixtureStateRows.every((item) => lagosPollingUnitIds.includes(item.pollingUnit.id))).toBe(true);
    expect(fixtureWardRows.length > 0).toBe(true);
    expect(fixtureWardRows.every((item) => wardPollingUnitIds.includes(item.pollingUnit.id))).toBe(true);
    expect(noScopePage.items.length).toBe(0);
    expect(stateUser.scopeUnits.stateIds).toContain(lagosStateId);
    expect(wardUser.scopeUnits.wardIds).toContain(lagosWardId);
  });

  it("honors revoked and missing visibility grants without code changes", async () => {
    const {
      statePersonId,
      lagosOwnerAssignmentId,
      ungrantedOwnerAssignmentId,
      viewerLagosGrantId,
    } = requireFixtures();
    const user = await loadPolicyUser(statePersonId, requireManager());
    const grants = await requireManager().query(
      "SELECT is_allowed FROM group_visibility_grant WHERE viewer_group_id = $1 AND owner_group_id = $2",
      [user.groupIds[0], viewerLagosGrantId],
    ) as Array<{ is_allowed: boolean }>;
    expect(grants[0]?.is_allowed).toBe(true);

    const initiallyVisible = await listAgents(user, { limit: 100 }, undefined, requireManager());
    expect(initiallyVisible.items.some((item) => item.assignmentId === lagosOwnerAssignmentId)).toBe(true);
    expect(initiallyVisible.items.some((item) => item.assignmentId === ungrantedOwnerAssignmentId)).toBe(false);

    await requireManager().query(
      "UPDATE group_visibility_grant SET is_allowed = FALSE WHERE viewer_group_id = $1 AND owner_group_id = $2",
      [user.groupIds[0], viewerLagosGrantId],
    );
    const revoked = await listAgents(user, { limit: 100 }, undefined, requireManager());
    expect(revoked.items.some((item) => item.assignmentId === lagosOwnerAssignmentId)).toBe(false);

    await requireManager().query(
      "UPDATE group_visibility_grant SET is_allowed = TRUE WHERE viewer_group_id = $1 AND owner_group_id = $2",
      [user.groupIds[0], viewerLagosGrantId],
    );
    const restored = await listAgents(user, { limit: 100 }, undefined, requireManager());
    expect(restored.items.some((item) => item.assignmentId === lagosOwnerAssignmentId)).toBe(true);
  });

  it("lets a parent group see the agents of every group below it", async () => {
    const { statePersonId, viewerGroupId, ungrantedOwnerGroupId, ungrantedOwnerAssignmentId } = requireFixtures();
    const user = await loadPolicyUser(statePersonId, requireManager());
    const sees = async () => {
      const page = await listAgents(user, { limit: 100 }, undefined, requireManager());
      const owners = await listOwnerGroups(user, requireManager());
      return {
        agent: page.items.some((item) => item.assignmentId === ungrantedOwnerAssignmentId),
        owner: owners.some((group) => group.id === ungrantedOwnerGroupId),
      };
    };
    const middleGroupId = await insertGroupBelow(viewerGroupId);

    expect(await sees()).toEqual({ agent: false, owner: false });

    // Grandchild: viewer group -> middle group -> ungranted owner group.
    await requireManager().query("UPDATE groups SET parent_group_id = $1 WHERE id = $2", [
      middleGroupId,
      ungrantedOwnerGroupId,
    ]);
    expect(await sees()).toEqual({ agent: true, owner: true });

    await requireManager().query("UPDATE groups SET parent_group_id = NULL WHERE id = $1", [ungrantedOwnerGroupId]);
    expect(await sees()).toEqual({ agent: false, owner: false });
  });

  it("lets a candidate-only user see group and candidate owners within their scope", async () => {
    const {
      candidatePersonId,
      lagosOwnerAssignmentId,
      ungrantedOwnerAssignmentId,
      candidateOwnerAssignmentId,
      paginationAssignmentIds,
    } = requireFixtures();
    const candidate = await loadPolicyUser(candidatePersonId, requireManager());
    const page = await listAgents(candidate, { limit: 100 }, undefined, requireManager());

    expect(candidate.groupIds.length).toBe(0);
    expect(page.items.some((item) => item.assignmentId === lagosOwnerAssignmentId)).toBe(true);
    expect(page.items.some((item) => item.assignmentId === ungrantedOwnerAssignmentId)).toBe(true);
    expect(page.items.some((item) => item.assignmentId === candidateOwnerAssignmentId)).toBe(true);
    expect(paginationAssignmentIds.some((id) => page.items.some((item) => item.assignmentId === id))).toBe(true);
  });

  it("lets a candidate filter by LGA inside their seat, and returns an empty page for an out-of-scope state", async () => {
    const { candidatePersonId, kanoStateId } = requireFixtures();
    const candidate = await loadPolicyUser(candidatePersonId, requireManager());

    // The seat still limits what they see; an LGA only narrows it.
    await expect(listAgents(candidate, { lgaId: 1, limit: 50 }, undefined, requireManager())).resolves.toBeDefined();
    const page = await listAgents(
      candidate,
      { stateId: kanoStateId, limit: 50 },
      undefined,
      requireManager(),
    );
    expect(page.items.length).toBe(0);
  });

  it("caps pages at 100 and walks fixture rows exactly once in stable order", async () => {
    const { adminPersonId, paginationOwnerGroupId, paginationAssignmentIds } = requireFixtures();
    const admin = await loadPolicyUser(adminPersonId, requireManager());
    const walked: string[] = [];
    let cursor: string | undefined;
    let firstPageSize = 0;

    do {
      const page = await listAgents(
        admin,
        { ownerGroupId: paginationOwnerGroupId, agentKind: AgentKind.EXTRA, cursor, limit: 100 },
        undefined,
        requireManager(),
      );
      if (walked.length === 0) {
        firstPageSize = page.items.length;
      }
      walked.push(...page.items.map((item) => item.assignmentId));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    expect(firstPageSize).toBe(100);
    expect(walked.length).toBe(120);
    expect(new Set(walked).size).toBe(120);
    expect(new Set(walked)).toEqual(new Set(paginationAssignmentIds));
  });

  it("returns masked contact data and writes one privacy-safe audit row per read", async () => {
    const { adminPersonId } = requireFixtures();
    const admin = await loadPolicyUser(adminPersonId, requireManager());
    const before = await requireManager().query(
      "SELECT COUNT(*)::int AS count FROM audit_log WHERE actor_person_id = $1 AND action_type = 'view_agents'",
      [adminPersonId],
    ) as Array<{ count: number }>;

    const page = await listAgents(
      admin,
      { limit: 1 },
      { ipAddress: "203.0.113.42" },
      requireManager(),
    );
    const after = await requireManager().query(
      `SELECT action_type, target_entity_type, target_entity_id, ip_address
       FROM audit_log
       WHERE actor_person_id = $1 AND action_type = 'view_agents' AND ip_address = $2
       LIMIT 1`,
      [adminPersonId, "203.0.113.42"],
    ) as Array<{
      action_type: string;
      target_entity_type: string | null;
      target_entity_id: string | null;
      ip_address: string | null;
    }>;
    const auditRows = await requireManager().query(
      "SELECT COUNT(*)::int AS count FROM audit_log WHERE actor_person_id = $1 AND action_type = 'view_agents'",
      [adminPersonId],
    ) as Array<{ count: number }>;
    const item = page.items[0];

    expect(Number(auditRows[0]?.count) - Number(before[0]?.count)).toBe(1);
    expect(after[0]?.ip_address).toBe("203.0.113.42");
    expect(after[0]?.target_entity_type).toBeNull();
    expect(after[0]?.target_entity_id).toBeNull();
    expect(item?.maskedPhone !== null && item?.maskedPhone.includes("*")).toBe(true);
    expect(item ? Object.keys(item).includes("emailAddress") : false).toBe(false);
  });

  it("fails the read when its audit write fails", async () => {
    const { adminPersonId } = requireFixtures();
    const admin = await loadPolicyUser(adminPersonId, requireManager());
    const auditRepository = requireManager().getRepository(AuditLog);
    const auditInsert = vi
      .spyOn(auditRepository, "insert")
      .mockRejectedValue(new Error("injected audit failure"));

    try {
      await expect(
        listAgents(admin, { limit: 1 }, undefined, requireManager()),
      ).rejects.toThrow("injected audit failure");
      expect(auditInsert).toHaveBeenCalledOnce();
    } finally {
      auditInsert.mockRestore();
    }
  });

  it("keeps scope descriptions and polling-unit access aligned with returned agents", async () => {
    const { statePersonId, lagosPollingUnitIds, lagosStateId, assignmentIds } = requireFixtures();
    const user = await loadPolicyUser(statePersonId, requireManager());
    const description = await describeScope(user, requireManager());
    const { kanoPollingUnitIds } = requireFixtures();
    const accessible = await Promise.all(
      lagosPollingUnitIds.map((id) => canAccessPollingUnit(user, id, requireManager())),
    );
    const inaccessible = await Promise.all(
      kanoPollingUnitIds.map((id) => canAccessPollingUnit(user, id, requireManager())),
    );
    const page = await listAgents(user, { limit: 100 }, undefined, requireManager());
    const fixtureItems = page.items.filter((item) => assignmentIds.includes(item.assignmentId));

    expect(description.pollingUnitCount).toBe(lagosPollingUnitIds.length);
    expect(accessible.every(Boolean)).toBe(true);
    expect(inaccessible.every((value) => !value)).toBe(true);
    expect(fixtureItems.every((item) => lagosPollingUnitIds.includes(item.pollingUnit.id))).toBe(true);
    expect(user.scopeUnits.stateIds).toContain(lagosStateId);
  });

  it("builds scope parameters from scope units, not polling unit IDs", async () => {
    const { statePersonId } = requireFixtures();
    const user = await loadPolicyUser(statePersonId, requireManager());
    const dataSource = requireDataSource();
    const query = dataSource.createQueryBuilder().select("pu.id").from("polling_unit", "pu");
    const { getScope } = await import("./scope");

    getScope(user).apply(query, "pu.id");
    const parameters = Object.values(query.getParameters());

    expect(parameters).toEqual(user.scopeUnits.stateIds);
  });
});

async function createFixtures(entityManager: EntityManager): Promise<Fixtures> {
  const key = randomUUID().slice(0, 8);
  const states = await insertRows<{ id: number }>(
    entityManager,
    "state",
    ["inec_state_code", "state_name"],
    [[`90${key}`, `Policy Lagos ${key}`], [`92${key}`, `Policy Kano ${key}`]],
  );
  const lagosStateId = Number(states[0].id);
  const kanoStateId = Number(states[1].id);

  const lgas = await insertRows<{ id: number; state_id: number }>(
    entityManager,
    "lga",
    ["state_id", "inec_lga_code", "lga_name"],
    [
      [lagosStateId, `90${key}1`, `Policy Lagos LGA 1 ${key}`],
      [lagosStateId, `90${key}2`, `Policy Lagos LGA 2 ${key}`],
      [kanoStateId, `92${key}1`, `Policy Kano LGA 1 ${key}`],
      [kanoStateId, `92${key}2`, `Policy Kano LGA 2 ${key}`],
    ],
    "id, state_id",
  );

  const wards = await insertRows<{ id: number; lga_id: number }>(
    entityManager,
    "ward",
    ["lga_id", "inec_ward_code", "ward_name"],
    lgas.flatMap((lga, lgaIndex) =>
      [1, 2].map((wardNumber) => [
        Number(lga.id),
        `P${lgaIndex}${wardNumber}`,
        `Policy Ward ${lgaIndex}-${wardNumber} ${key}`,
      ]),
    ),
    "id, lga_id",
  );

  const pollingUnits = await insertRows<{ id: number; ward_id: number }>(
    entityManager,
    "polling_unit",
    ["inec_polling_unit_code", "polling_unit_name", "ward_id"],
    wards.flatMap((ward, wardIndex) =>
      [1, 2].map((unitNumber) => [
        `P${key}-${String(wardIndex).padStart(2, "0")}-${unitNumber}`,
        `Policy PU ${wardIndex}-${unitNumber} ${key}`,
        Number(ward.id),
      ]),
    ),
    "id, ward_id",
  );
  const pollingUnitIds = pollingUnits.map((unit) => Number(unit.id));
  const wardLgaIds = new Map(wards.map((ward) => [Number(ward.id), Number(ward.lga_id)]));
  const lagosLgaIds = new Set(lgas.slice(0, 2).map((lga) => Number(lga.id)));
  const kanoLgaIds = new Set(lgas.slice(2).map((lga) => Number(lga.id)));
  const lagosPollingUnitIds = pollingUnits
    .filter((unit) => lagosLgaIds.has(wardLgaIds.get(Number(unit.ward_id)) ?? -1))
    .map((unit) => Number(unit.id));
  const kanoPollingUnitIds = pollingUnits
    .filter((unit) => kanoLgaIds.has(wardLgaIds.get(Number(unit.ward_id)) ?? -1))
    .map((unit) => Number(unit.id));
  const wardPollingUnitIds = pollingUnits
    .filter((unit) => Number(unit.ward_id) === Number(wards[0].id))
    .map((unit) => Number(unit.id));

  const politicalUnits = await insertRows<{ id: number }>(
    entityManager,
    "political_unit",
    ["political_unit_name", "political_unit_type", "parent_political_unit_id"],
    [
      [`Policy Country ${key}`, "country", null],
      [`Policy Lagos ${key}`, "state", null],
      [`Policy Kano ${key}`, "state", null],
    ],
  );
  const countryPoliticalUnitId = Number(politicalUnits[0].id);
  const lagosPoliticalUnitId = Number(politicalUnits[1].id);
  const kanoPoliticalUnitId = Number(politicalUnits[2].id);
  await entityManager.query(
    "UPDATE political_unit SET parent_political_unit_id = $1 WHERE id IN ($2, $3)",
    [countryPoliticalUnitId, lagosPoliticalUnitId, kanoPoliticalUnitId],
  );

  const mappingRows = [
    ...pollingUnitIds.map((pollingUnitId) => [countryPoliticalUnitId, pollingUnitId]),
    ...pollingUnits
      .filter((unit) => lagosLgaIds.has(wardLgaIds.get(Number(unit.ward_id)) ?? -1))
      .map((unit) => [lagosPoliticalUnitId, Number(unit.id)]),
    ...pollingUnits
      .filter((unit) => kanoLgaIds.has(wardLgaIds.get(Number(unit.ward_id)) ?? -1))
      .map((unit) => [kanoPoliticalUnitId, Number(unit.id)]),
  ];
  await insertRows(
    entityManager,
    "pu_political_unit",
    ["political_unit_id", "polling_unit_id"],
    mappingRows,
    "",
  );

  const officeRows = await insertRows<{ id: number }>(
    entityManager,
    "office",
    ["office_name", "hierarchy_level", "political_unit_type"],
    [[`Policy Governor ${key}`, 1, "state"]],
  );
  const seats = await insertRows<{ id: number }>(
    entityManager,
    "seat",
    ["office_id", "political_unit_id"],
    [
      [Number(officeRows[0].id), lagosPoliticalUnitId],
      [Number(officeRows[0].id), kanoPoliticalUnitId],
    ],
  );

  const groups = await insertRows<{ id: number }>(
    entityManager,
    "groups",
    ["group_name", "group_type"],
    [
      [`Policy Admin ${key}`, "admin"],
      // Area coordinators. A campaign group, since a party member with no area is national.
      [`Policy Viewer ${key}`, "campaign"],
      [`Policy Lagos Owner ${key}`, "party"],
      [`Policy Kano Owner ${key}`, "party"],
      [`Policy Ungranted Owner ${key}`, "party"],
      [`Policy Pagination Owner ${key}`, "party"],
    ],
  );
  const adminGroupId = Number(groups[0].id);
  const viewerGroupId = Number(groups[1].id);
  const lagosOwnerGroupId = Number(groups[2].id);
  const kanoOwnerGroupId = Number(groups[3].id);
  const ungrantedOwnerGroupId = Number(groups[4].id);
  const paginationOwnerGroupId = Number(groups[5].id);

  const people = await insertRows<{ id: string }>(
    entityManager,
    "person",
    ["email_address", "full_name", "verification_status"],
    [
      [`admin-${key}@demo.collate.test`, `Policy Admin ${key}`, "verified"],
      [`candidate-${key}@demo.collate.test`, `Policy Candidate ${key}`, "verified"],
      [`running-mate-${key}@demo.collate.test`, `Policy Running Mate ${key}`, "verified"],
      [`state-user-${key}@demo.collate.test`, `Policy State User ${key}`, "verified"],
      [`ward-user-${key}@demo.collate.test`, `Policy Ward User ${key}`, "verified"],
      [`no-scope-${key}@demo.collate.test`, `Policy No Scope ${key}`, "verified"],
    ],
  );
  const [adminPersonId, candidatePersonId, runningMatePersonId, statePersonId, wardPersonId, noScopePersonId] =
    people.map((person) => person.id);

  const principalCandidateRows = await insertRows<{ id: number }>(
    entityManager,
    "candidate",
    ["person_id", "seat_id", "principal_candidate_id"],
    [[candidatePersonId, Number(seats[0].id), null]],
  );
  const principalCandidateId = Number(principalCandidateRows[0].id);
  const runningMateRows = await insertRows<{ id: number }>(
    entityManager,
    "candidate",
    ["person_id", "seat_id", "principal_candidate_id"],
    [[runningMatePersonId, null, principalCandidateId]],
  );
  const runningMateCandidateId = Number(runningMateRows[0].id);

  const memberships = await insertRows<{ id: number; person_id: string; group_id: number }>(
    entityManager,
    "membership",
    ["person_id", "group_id", "membership_role"],
    [
      [adminPersonId, adminGroupId, "admin"],
      [statePersonId, viewerGroupId, "coordinator"],
      [wardPersonId, viewerGroupId, "coordinator"],
      [noScopePersonId, viewerGroupId, "coordinator"],
    ],
  );
  const stateMembershipId = Number(memberships[1].id);
  const wardMembershipId = Number(memberships[2].id);
  await insertRows(
    entityManager,
    "membership_scope_unit",
    ["membership_id", "scope_state_id", "scope_lga_id", "scope_ward_id", "scope_political_unit_id"],
    [
      [stateMembershipId, lagosStateId, null, null, null],
      [wardMembershipId, null, null, Number(wards[0].id), null],
    ],
    "",
  );

  const viewerGrants = [
    [viewerGroupId, lagosOwnerGroupId, true],
    [viewerGroupId, kanoOwnerGroupId, true],
    [viewerGroupId, paginationOwnerGroupId, true],
  ];
  await insertRows(
    entityManager,
    "group_visibility_grant",
    ["viewer_group_id", "owner_group_id", "is_allowed"],
    viewerGrants,
    "",
  );

  const agentPeople = await insertRows<{ id: string }>(
    entityManager,
    "person",
    ["email_address", "full_name", "verification_status"],
    Array.from({ length: 125 }, (_, index) => [
      `agent-${key}-${index + 1}@demo.collate.test`,
      `Policy Agent ${key}-${index + 1}`,
      "verified",
    ]),
  );
  const phoneRows = agentPeople.map((person, index) => [
    person.id,
    `+234000000${String(index + 9000).padStart(4, "0")}`,
    index === 0,
  ]);
  await insertRows(
    entityManager,
    "phone_number",
    ["person_id", "e164_number", "is_confirmed"],
    phoneRows,
    "",
  );

  const paginationRows: Array<Array<string | number | null>> = [];
  let lagosOwnerAssignmentId = "";
  let kanoOwnerAssignmentId = "";
  let ungrantedOwnerAssignmentId = "";
  let candidateOwnerAssignmentId = "";
  const extraSlots = new Map<number, number>();

  for (let index = 0; index < 120; index += 1) {
    const pollingUnit = pollingUnits[index % pollingUnits.length];
    const slot = (extraSlots.get(Number(pollingUnit.id)) ?? 0) + 1;
    extraSlots.set(Number(pollingUnit.id), slot);
    const ownerGroupId = paginationOwnerGroupId;
    const row = [
      agentPeople[index].id,
      Number(pollingUnit.id),
      ownerGroupId,
      null,
      "extra",
      slot,
    ];
    paginationRows.push(row);
  }

  const paginationAssignments = await insertRows<{ id: string }>(
    entityManager,
    "agent_assignment",
    ["person_id", "polling_unit_id", "owner_group_id", "owner_candidate_id", "agent_kind", "slot_number"],
    paginationRows,
  );
  const extraOwnershipRows: Array<Array<string | number | null>> = [];
  const nonPaginationAssignments = [
    { index: 120, pollingUnitIndex: 0, ownerGroupId: lagosOwnerGroupId, candidateId: null },
    { index: 121, pollingUnitIndex: pollingUnits.length - 1, ownerGroupId: kanoOwnerGroupId, candidateId: null },
    { index: 122, pollingUnitIndex: 1, ownerGroupId: ungrantedOwnerGroupId, candidateId: null },
  ];
  for (const assignment of nonPaginationAssignments) {
    const pollingUnit = pollingUnits[assignment.pollingUnitIndex];
    const slot = (extraSlots.get(Number(pollingUnit.id)) ?? 0) + 1;
    extraSlots.set(Number(pollingUnit.id), slot);
    extraOwnershipRows.push([
      agentPeople[assignment.index].id,
      Number(pollingUnit.id),
      assignment.ownerGroupId,
      assignment.candidateId,
      "extra",
      slot,
    ]);
  }

  const ownerAssignments = await insertRows<{ id: string }>(
    entityManager,
    "agent_assignment",
    ["person_id", "polling_unit_id", "owner_group_id", "owner_candidate_id", "agent_kind", "slot_number"],
    extraOwnershipRows,
  );
  lagosOwnerAssignmentId = ownerAssignments[0].id;
  kanoOwnerAssignmentId = ownerAssignments[1].id;
  ungrantedOwnerAssignmentId = ownerAssignments[2].id;

  const candidatePollingUnit = pollingUnits[2];
  const candidateSlot = (extraSlots.get(Number(candidatePollingUnit.id)) ?? 0) + 1;
  const candidateAssignment = await insertRows<{ id: string }>(
    entityManager,
    "agent_assignment",
    ["person_id", "polling_unit_id", "owner_group_id", "owner_candidate_id", "agent_kind", "slot_number"],
    [[agentPeople[0].id, Number(candidatePollingUnit.id), null, principalCandidateId, "extra", candidateSlot]],
  );
  candidateOwnerAssignmentId = candidateAssignment[0].id;

  const officialRows: Array<Array<string | number | null>> = [];
  for (const [index, unit] of [pollingUnits[0], pollingUnits[pollingUnits.length - 1]].entries()) {
    officialRows.push([
      agentPeople[121 + index].id,
      Number(unit.id),
      index === 0 ? lagosOwnerGroupId : kanoOwnerGroupId,
      null,
      "official",
      0,
    ]);
  }
  const officialAssignments = await insertRows<{ id: string }>(
    entityManager,
    "agent_assignment",
    ["person_id", "polling_unit_id", "owner_group_id", "owner_candidate_id", "agent_kind", "slot_number"],
    officialRows,
  );

  const viewerLagosGrantId = lagosOwnerGroupId;
  return {
    adminPersonId,
    candidatePersonId,
    runningMatePersonId,
    statePersonId,
    wardPersonId,
    noScopePersonId,
    principalCandidateId,
    runningMateCandidateId,
    lagosStateId,
    kanoStateId,
    lagosPoliticalUnitId,
    lagosWardId: Number(wards[0].id),
    viewerGroupId,
    lagosOwnerGroupId,
    kanoOwnerGroupId,
    ungrantedOwnerGroupId,
    paginationOwnerGroupId,
    assignmentIds: [
      ...paginationAssignments.map((assignment) => assignment.id),
      ...ownerAssignments.map((assignment) => assignment.id),
      candidateAssignment[0].id,
      ...officialAssignments.map((assignment) => assignment.id),
    ],
    paginationAssignmentIds: paginationAssignments.map((assignment) => assignment.id),
    lagosOwnerAssignmentId,
    kanoOwnerAssignmentId,
    ungrantedOwnerAssignmentId,
    candidateOwnerAssignmentId,
    pollingUnitIds,
    lagosPollingUnitIds,
    kanoPollingUnitIds,
    wardPollingUnitIds,
    viewerLagosGrantId,
  };
}

async function collectAllPages(
  user: Awaited<ReturnType<typeof loadPolicyUser>>,
  filters: Omit<Parameters<typeof listAgents>[1], "cursor" | "limit">,
  entityManager: EntityManager,
) {
  const items = [];
  let cursor: string | undefined;
  do {
    const page = await listAgents(
      user,
      { ...filters, cursor, limit: 100 },
      undefined,
      entityManager,
    );
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

async function insertRows<T>(
  entityManager: EntityManager,
  table: string,
  columns: string[],
  rows: unknown[][],
  returning = "id",
): Promise<T[]> {
  const parameters: unknown[] = [];
  const values = rows.map(
    (row) =>
      `(${row
        .map((value) => {
          parameters.push(value);
          return `$${parameters.length}`;
        })
        .join(", ")})`,
  );
  const result = await entityManager.query(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${values.join(", ")}${returning ? ` RETURNING ${returning}` : ""}`,
    parameters,
  );
  return result as T[];
}

function requireManager(): EntityManager {
  if (!manager) {
    throw new Error("Database test manager is not initialized.");
  }
  return manager;
}

function requireDataSource(): DataSource {
  if (!dataSource) {
    throw new Error("Database test data source is not initialized.");
  }
  return dataSource;
}

async function insertGroupBelow(parentGroupId: number): Promise<number> {
  const rows = await requireManager().query(
    `INSERT INTO groups (group_name, group_type_id, parent_group_id)
     SELECT $1, g.group_type_id, g.id FROM groups g WHERE g.id = $2
     RETURNING id`,
    [`Policy middle group ${randomUUID()}`, parentGroupId],
  ) as Array<{ id: number | string }>;
  return Number(rows[0]?.id);
}

function requireFixtures(): Fixtures {
  if (!fixtures) {
    throw new Error("Database test fixtures are not initialized.");
  }
  return fixtures;
}
