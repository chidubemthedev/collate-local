import { describe, expect, it, vi } from "vitest";
import type { EntityManager } from "typeorm";
import { AgentAssignment } from "../../db/entities/agent-assignment.entity";
import { AuditLog } from "../../db/entities/audit-log.entity";
import { listAgents, maskPhoneNumber, validateAgentFilters } from "./list-agents";
import { InvalidFilterError } from "../errors";
import type { PolicyUser } from "./policy-user";

const candidateUser: PolicyUser = {
  personId: "person-id",
  isAdmin: false,
  candidateId: 1,
  seatId: 1,
  groupIds: [],
  scopeUnits: { stateIds: [], lgaIds: [], wardIds: [], politicalUnitIds: [] },
};

const adminUser: PolicyUser = {
  ...candidateUser,
  personId: "22222222-2222-4222-8222-222222222222",
  isAdmin: true,
};

describe("agent policy filters and phone masking", () => {
  it("keeps the country code and last four digits only", () => {
    expect(maskPhoneNumber("+2348012345678")).toBe("+234******5678");
    expect(maskPhoneNumber(null)).toBeNull();
  });

  it("rejects LGA filters for non-admin candidates", () => {
    expect(() => validateAgentFilters(candidateUser, { lgaId: 1, limit: 50 })).toThrow(
      InvalidFilterError,
    );
    expect(() => validateAgentFilters(candidateUser, { wardId: 1, limit: 50 })).not.toThrow();
  });

  it("writes its individual-agent read audit in the same transaction", async () => {
    const events: string[] = [];
    const queryBuilder = {
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      getRawMany: vi.fn(async () => {
        events.push("read");
        return [];
      }),
    };
    const auditInsert = vi.fn(async () => {
      events.push("audit");
    });
    const managerRef: { current: EntityManager | null } = { current: null };
    const transaction = vi.fn(async (run: (manager: EntityManager) => Promise<unknown>) => {
      events.push("begin");
      if (!managerRef.current) {
        throw new Error("transaction manager is unavailable");
      }
      const result = await run(managerRef.current);
      events.push("commit");
      return result;
    });
    const managerMock = {
      queryRunner: { isTransactionActive: false },
      getRepository: (entity: typeof AgentAssignment | typeof AuditLog) =>
        entity === AuditLog
          ? { insert: auditInsert }
          : { createQueryBuilder: () => queryBuilder },
      transaction,
    };
    const manager = managerMock as unknown as EntityManager;
    managerRef.current = manager;

    await listAgents(adminUser, { limit: 50 }, { ipAddress: "203.0.113.2" }, manager);

    expect(events).toEqual(["begin", "read", "audit", "commit"]);
    expect(auditInsert).toHaveBeenCalledWith({
      actorPersonId: adminUser.personId,
      actionType: "view_agents",
      targetEntityType: null,
      targetEntityId: null,
      ipAddress: "203.0.113.2",
    });
  });
});
