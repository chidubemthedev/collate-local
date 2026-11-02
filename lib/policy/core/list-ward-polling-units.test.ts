import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityManager, SelectQueryBuilder } from "typeorm";
import { AgentAssignment } from "../../db/entities/agent-assignment.entity";
import { AuditLog } from "../../db/entities/audit-log.entity";
import { PollingUnit } from "../../db/entities/polling-unit.entity";
import type { PolicyUser } from "./policy-user";

const mocks = vi.hoisted(() => ({
  loadPolicyUser: vi.fn(),
}));

vi.mock("./policy-user", () => ({
  loadPolicyUser: mocks.loadPolicyUser,
}));

import {
  listWardPollingUnits,
  wardPollingUnitsQuerySchema,
} from "./list-ward-polling-units";

const scopedUser: PolicyUser = {
  personId: "11111111-1111-4111-8111-111111111111",
  isAdmin: false,
  candidateId: null,
  seatId: null,
  groupIds: [900],
  scopeUnits: { stateIds: [1], lgaIds: [], wardIds: [], politicalUnitIds: [] },
};

interface TestPollingUnit {
  id: number;
  code: string;
  name: string | null;
  wardCode: string;
  lgaCode: string;
  stateCode: string;
  latitude: number | null;
  longitude: number | null;
  wardId: number;
}

interface TestAgent {
  pollingUnitId: number;
  assignmentId: string;
  agentKind: "official" | "extra";
  slotNumber: number;
  fullName: string;
  phoneNumber: string | null;
  ownerType: "group" | "candidate";
  ownerId: number;
  ownerDisplayName: string;
  ownerGroupId: number | null;
}

interface TestData {
  pollingUnits: TestPollingUnit[];
  agents: TestAgent[];
  visibleWardIds: Set<number>;
  visibleOwnerGroupIds: Set<number>;
  failAudit?: boolean;
}

function makeManager(data: TestData) {
  const auditRows: Array<Record<string, unknown>> = [];
  const queryFilters: Array<Record<string, unknown>> = [];
  const manager = {
    queryRunner: { isTransactionActive: true },
    getRepository(entity: typeof PollingUnit | typeof AgentAssignment | typeof AuditLog) {
      if (entity === AuditLog) {
        return {
          insert: vi.fn(async (row: Record<string, unknown>) => {
            if (data.failAudit) {
              throw new Error("audit write failed");
            }
            auditRows.push(row);
          }),
        };
      }

      const kind = entity === PollingUnit ? "pollingUnit" : "assignment";
      return {
        createQueryBuilder() {
          const parameters: Record<string, unknown> = {};
          let hasFalseClause = false;
          let hasOwnerFilter = false;
          let pageSize = Number.MAX_SAFE_INTEGER;

          const builder = {
            select() {
              return builder;
            },
            addSelect() {
              return builder;
            },
            innerJoin() {
              return builder;
            },
            leftJoin() {
              return builder;
            },
            where(_condition: unknown, values?: Record<string, unknown>) {
              Object.assign(parameters, values);
              return builder;
            },
            andWhere(condition: unknown, values?: Record<string, unknown>) {
              hasFalseClause ||= condition === "FALSE";
              Object.assign(parameters, values);
              if (values && Object.keys(values).some((key) => key.startsWith("policyVisibleOwnerGroupIds"))) {
                hasOwnerFilter = true;
              }
              queryFilters.push({ condition, values });
              return builder;
            },
            orderBy() {
              return builder;
            },
            addOrderBy() {
              return builder;
            },
            limit(value: number) {
              pageSize = value;
              return builder;
            },
            async getRawOne<T>() {
              const wardId = Number(parameters.wardPollingUnitsWardId);
              return !hasFalseClause && data.visibleWardIds.has(wardId)
                ? ({ id: wardId } as T)
                : null;
            },
            async getRawMany<T>() {
              if (hasFalseClause) {
                return [];
              }

              if (kind === "pollingUnit") {
                const wardId = Number(parameters.wardPollingUnitsWardId);
                const cursor = parameters.wardPollingUnitsCursor;
                return data.pollingUnits
                  .filter((unit) => unit.wardId === wardId && data.visibleWardIds.has(wardId))
                  .filter((unit) => typeof cursor !== "string" || unit.code > cursor)
                  .sort((left, right) => left.code.localeCompare(right.code))
                  .slice(0, pageSize) as T[];
              }

              const unitIds = parameters.wardPollingUnitsIds as number[];
              return data.agents
                .filter((agent) => unitIds.includes(agent.pollingUnitId))
                .filter((agent) =>
                  !hasOwnerFilter ||
                  agent.ownerGroupId === null ||
                  data.visibleOwnerGroupIds.has(agent.ownerGroupId),
                )
                .sort((left, right) => {
                  const kindOrder = (left.agentKind === "official" ? 0 : 1) -
                    (right.agentKind === "official" ? 0 : 1);
                  return kindOrder || left.slotNumber - right.slotNumber;
                }) as T[];
            },
          };

          return builder as unknown as SelectQueryBuilder<PollingUnit | AgentAssignment>;
        },
      };
    },
  };

  return {
    manager: manager as unknown as EntityManager,
    auditRows,
    queryFilters,
  };
}

function makePollingUnits(count: number, wardId = 7): TestPollingUnit[] {
  return Array.from({ length: count }, (_, index) => {
    const code = String(index + 1).padStart(3, "0");
    return {
      id: index + 1,
      code,
      name: null,
      wardCode: "W",
      lgaCode: "L",
      stateCode: "S",
      latitude: null,
      longitude: null,
      wardId,
    };
  });
}

function makeTestData(
  overrides: Partial<TestData> = {},
): TestData {
  return {
    pollingUnits: makePollingUnits(1),
    agents: [],
    visibleWardIds: new Set([7]),
    visibleOwnerGroupIds: new Set([11, 12]),
    ...overrides,
  };
}

describe("listWardPollingUnits", () => {
  beforeEach(() => {
    mocks.loadPolicyUser.mockReset();
    mocks.loadPolicyUser.mockResolvedValue(scopedUser);
  });

  it("returns no data for a ward outside scope and records only the ward target", async () => {
    const { manager, auditRows } = makeManager(makeTestData({
      visibleWardIds: new Set([8]),
    }));

    await expect(
      listWardPollingUnits(scopedUser.personId, 7, { limit: 50 }, {}, manager),
    ).resolves.toBeNull();
    expect(auditRows).toEqual([{
      actorPersonId: scopedUser.personId,
      actionType: "view_ward_polling_units",
      targetEntityType: "ward",
      targetEntityId: "7",
      ipAddress: null,
    }]);
  });

  it("returns no data for a user with no scope", async () => {
    mocks.loadPolicyUser.mockResolvedValue({
      ...scopedUser,
      groupIds: [],
      scopeUnits: { stateIds: [], lgaIds: [], wardIds: [], politicalUnitIds: [] },
    });
    const { manager } = makeManager(makeTestData());

    await expect(
      listWardPollingUnits(scopedUser.personId, 7, { limit: 50 }, {}, manager),
    ).resolves.toBeNull();
  });

  it("filters hidden owners and masks agent phones in official-first order", async () => {
    const phoneNumber = ["+", "1", "202", "555", "0123"].join("");
    const { manager, auditRows, queryFilters } = makeManager(makeTestData({
      agents: [
        {
          pollingUnitId: 1,
          assignmentId: "11111111-1111-4111-8111-111111111103",
          agentKind: "extra",
          slotNumber: 2,
          fullName: "Agent Three",
          phoneNumber,
          ownerType: "group",
          ownerId: 12,
          ownerDisplayName: "Second visible owner",
          ownerGroupId: 12,
        },
        {
          pollingUnitId: 1,
          assignmentId: "11111111-1111-4111-8111-111111111101",
          agentKind: "extra",
          slotNumber: 1,
          fullName: "Agent One",
          phoneNumber,
          ownerType: "group",
          ownerId: 13,
          ownerDisplayName: "Hidden owner",
          ownerGroupId: 13,
        },
        {
          pollingUnitId: 1,
          assignmentId: "11111111-1111-4111-8111-111111111102",
          agentKind: "official",
          slotNumber: 0,
          fullName: "Agent Two",
          phoneNumber,
          ownerType: "group",
          ownerId: 11,
          ownerDisplayName: "Allowed owner",
          ownerGroupId: 11,
        },
      ],
    }));
    const page = await listWardPollingUnits(
      scopedUser.personId,
      7,
      { limit: 50 },
      { ipAddress: "203.0.113.1" },
      manager,
    );

    expect(page?.items[0]?.agents.map((agent) => agent.agentKind)).toEqual([
      "official",
      "extra",
    ]);
    expect(page?.items[0]?.agents.map((agent) => agent.slotNumber)).toEqual([0, 2]);
    expect(page?.items[0]?.agents[0]?.maskedPhone).toMatch(/^\+1\*+0123$/);
    expect(Object.keys(page?.items[0]?.agents[0] ?? {}).sort()).toEqual([
      "agentKind",
      "assignmentId",
      "fullName",
      "maskedPhone",
      "owner",
      "slotNumber",
    ]);
    expect(queryFilters.some(({ values }) =>
      values && Object.keys(values as object).some((key) => key.startsWith("policyVisibleOwnerGroupIds")),
    )).toBe(true);
    expect(page?.items[0]?.agents).toHaveLength(2);
    expect(auditRows).toEqual([{
      actorPersonId: scopedUser.personId,
      actionType: "view_ward_polling_units",
      targetEntityType: "ward",
      targetEntityId: "7",
      ipAddress: "203.0.113.1",
    }]);
  });

  it("caps a page at 100 polling units and returns a keyset cursor", async () => {
    const { manager } = makeManager(makeTestData({
      pollingUnits: makePollingUnits(102),
    }));
    const page = await listWardPollingUnits(
      scopedUser.personId,
      7,
      { limit: 100 },
      {},
      manager,
    );

    expect(page?.items).toHaveLength(100);
    expect(page?.items[0]?.code).toBe("001");
    expect(page?.items[99]?.code).toBe("100");
    expect(page?.nextCursor).toBeTruthy();
  });

  it("fails the read when writing the audit row fails", async () => {
    const { manager } = makeManager(makeTestData({ failAudit: true }));

    await expect(
      listWardPollingUnits(scopedUser.personId, 7, { limit: 50 }, {}, manager),
    ).rejects.toThrow("audit write failed");
  });

  it("rejects limits above the configured page cap", () => {
    expect(wardPollingUnitsQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(wardPollingUnitsQuerySchema.parse({}).limit).toBe(50);
  });
});
