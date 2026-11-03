import { describe, expect, it, vi } from "vitest";
import type { EntityManager } from "typeorm";
import { AuditLog } from "../db/entities/audit-log.entity";
import { Broadcast } from "../db/entities/broadcast.entity";
import { listBroadcastDeliveries, listBroadcasts } from "./queries";
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

  describe("listBroadcasts response fields", () => {
    it("returns sender, audience labels, a trimmed title, and grouped delivery counts", async () => {
      const messageText = `  ${"x".repeat(60)} and more text`;
      const queryBuilder = {
        leftJoin: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getRawMany: vi.fn(async () => [{
          id: "44444444-4444-4444-8444-444444444444",
          status: "completed",
          messageText,
          audienceFilter: { stateId: 7, agentKind: "official" },
          scheduledSendAt: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          senderId: user.personId,
          senderDisplayName: "Sender",
        }]),
      };
      const query = vi.fn(async (sql: string) => {
        if (sql.includes("GROUP BY broadcast_id")) {
          return [{
            broadcastId: "44444444-4444-4444-8444-444444444444",
            pending: 1,
            sent: 2,
            delivered: 3,
            deliveredBySms: 4,
            failed: 5,
            tappedOk: 6,
          }];
        }
        return [{ kind: "state", id: 7, name: "Selected area" }];
      });
      const auditInsert = vi.fn(async () => undefined);
      const managerRef: { current: EntityManager | null } = { current: null };
      const managerMock = {
        queryRunner: { isTransactionActive: false },
        getRepository: (entity: typeof AuditLog | typeof Broadcast) =>
          entity === AuditLog
            ? { insert: auditInsert }
            : { createQueryBuilder: () => queryBuilder },
        query,
        transaction: vi.fn(async (run: (manager: EntityManager) => Promise<unknown>) => {
          if (!managerRef.current) throw new Error("transaction manager is unavailable");
          return run(managerRef.current);
        }),
      };
      managerRef.current = managerMock as unknown as EntityManager;

      const page = await listBroadcasts(
        user,
        { limit: 50, ipAddress: "203.0.113.3" },
        managerRef.current,
      );

      expect(page.items[0]).toMatchObject({
        title: messageText.slice(0, 60).trim(),
        sender: { id: user.personId, displayName: "Sender" },
        audienceSummary: ["Selected area", "Official agents"],
        deliveryCounts: {
          pending: 1,
          sent: 2,
          delivered: 3,
          deliveredBySms: 4,
          failed: 5,
          tappedOk: 6,
        },
      });
      expect(query.mock.calls.filter(([sql]) => sql.includes("GROUP BY broadcast_id"))).toHaveLength(1);
      expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
        actorPersonId: user.personId,
        actionType: "view_broadcasts",
      }));
    });
  });
});
