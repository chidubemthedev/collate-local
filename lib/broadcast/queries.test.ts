import { describe, expect, it, vi } from "vitest";
import type { EntityManager } from "typeorm";
import { AuditLog } from "../db/entities/audit-log.entity";
import { Broadcast } from "../db/entities/broadcast.entity";
import { listBroadcastDeliveries } from "./queries";
import type { PolicyUser } from "../policy/core/policy-user";

const user: PolicyUser = {
  personId: "33333333-3333-4333-8333-333333333333",
  isAdmin: true,
  candidateId: null,
  seatId: null,
  groupIds: [],
  scopeUnits: { stateIds: [], lgaIds: [], wardIds: [], politicalUnitIds: [] },
};

describe("listBroadcastDeliveries audit", () => {
  it("writes the individual-recipient audit in the same transaction as the read", async () => {
    const events: string[] = [];
    const queryBuilder = {
      innerJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      getOne: vi.fn(async () => ({
        id: "44444444-4444-4444-8444-444444444444",
        broadcastStatus: "completed",
        createdAt: new Date(),
      })),
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
      getRepository: (entity: typeof AuditLog | typeof Broadcast) =>
        entity === AuditLog
          ? { insert: auditInsert }
          : { createQueryBuilder: () => queryBuilder },
      transaction,
    };
    const manager = managerMock as unknown as EntityManager;
    managerRef.current = manager;

    await listBroadcastDeliveries(
      user,
      "44444444-4444-4444-8444-444444444444",
      { limit: 50, ipAddress: "203.0.113.3" },
      manager,
    );

    expect(events).toEqual(["begin", "read", "audit", "commit"]);
    expect(auditInsert).toHaveBeenCalledWith({
      actorPersonId: user.personId,
      actionType: "view_broadcast_deliveries",
      targetEntityType: "broadcast",
      targetEntityId: "44444444-4444-4444-8444-444444444444",
      ipAddress: "203.0.113.3",
    });
  });
});
