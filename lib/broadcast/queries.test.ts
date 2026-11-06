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

describe("listBroadcastDeliveries paging", () => {
  // Every delivery of a broadcast is inserted at once, so they share one created_at, down to the
  // microsecond. The cursor must keep all six decimals or the next page matches nothing.
  const BROADCAST_ID = "44444444-4444-4444-8444-444444444444";
  const CREATED_AT = "2026-01-01T09:30:00.123456Z";

  function setup(rowCount: number) {
    const rows = Array.from({ length: rowCount }, (_, i) => ({
      id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(900000000000 - i).padStart(12, "0")}`,
      personId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      fullName: `Person ${i}`,
      phoneNumber: null,
      channel: "telegram",
      status: "pending",
      sentAt: null,
      deliveredAt: null,
      tappedOkAt: null,
      failedAt: null,
      createdAt: new Date(CREATED_AT),
      cursorCreatedAt: CREATED_AT,
    }));
    const queryBuilder = {
      innerJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      getOne: vi.fn(async () => ({ id: BROADCAST_ID, broadcastStatus: "completed", createdAt: new Date() })),
      getRawMany: vi.fn(async () => rows),
    };
    const manager = {
      queryRunner: { isTransactionActive: true },
      getRepository: (entity: typeof AuditLog | typeof Broadcast) =>
        entity === AuditLog
          ? { insert: vi.fn(async () => undefined) }
          : { createQueryBuilder: () => queryBuilder },
      query: vi.fn(async () => []),
    } as unknown as EntityManager;
    return { manager, queryBuilder };
  }

  it("selects created_at with microseconds for the cursor", async () => {
    const { manager, queryBuilder } = setup(1);
    await listBroadcastDeliveries(user, BROADCAST_ID, { limit: 50 }, manager);
    const selects = queryBuilder.addSelect.mock.calls.map((call) => String(call[0]));
    expect(selects.some((sql) => sql.includes("HH24:MI:SS.US"))).toBe(true);
  });

  it("keeps every decimal of created_at in the next-page cursor", async () => {
    const { manager } = setup(3);
    const page = await listBroadcastDeliveries(user, BROADCAST_ID, { limit: 2 }, manager);

    expect(page?.items).toHaveLength(2);
    expect(page?.nextCursor).not.toBeNull();
    const cursor = JSON.parse(Buffer.from(page!.nextCursor!, "base64url").toString("utf8"));
    expect(cursor.createdAt).toBe(CREATED_AT);
  });

  it("compares the cursor's text directly, not through a JavaScript Date", async () => {
    const first = setup(3);
    const page = await listBroadcastDeliveries(user, BROADCAST_ID, { limit: 2 }, first.manager);

    const second = setup(1);
    await listBroadcastDeliveries(
      user,
      BROADCAST_ID,
      { limit: 2, cursor: page!.nextCursor! },
      second.manager,
    );

    const brackets = second.queryBuilder.andWhere.mock.calls[0][0] as {
      whereFactory: (where: unknown) => void;
    };
    const conditions: Array<{ sql: string; params: Record<string, unknown> }> = [];
    const where = {
      where: (sql: string, params: Record<string, unknown>) => {
        conditions.push({ sql, params });
        return where;
      },
      orWhere: (sql: string, params: Record<string, unknown>) => {
        conditions.push({ sql, params });
        return where;
      },
    };
    brackets.whereFactory(where);

    expect(conditions[0].sql).toContain("CAST(:cursorCreatedAt AS timestamptz)");
    expect(conditions[0].params.cursorCreatedAt).toBe(CREATED_AT);
    expect(conditions[1].params.cursorCreatedAt).toBe(CREATED_AT);
  });
});

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

  describe("listBroadcastDeliveries recipient details", () => {
    const BROADCAST_ID = "44444444-4444-4444-8444-444444444444";
    const people = {
      candidate: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      runningMate: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
      official: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
      extra: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
      unknown: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
    };

    function deliveryRow(personId: string, index: number) {
      return {
        id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${index}`,
        personId,
        fullName: `Person ${index}`,
        phoneNumber: null,
        channel: "telegram",
        status: "delivered",
        sentAt: null,
        deliveredAt: null,
        tappedOkAt: null,
        failedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      };
    }

    function setup(recipientRows: unknown[]) {
      const rows = [
        deliveryRow(people.candidate, 1),
        deliveryRow(people.runningMate, 2),
        deliveryRow(people.official, 3),
        deliveryRow(people.extra, 4),
        deliveryRow(people.unknown, 5),
        // The same person twice must not be looked up twice.
        deliveryRow(people.official, 6),
      ];
      const queryBuilder = {
        innerJoin: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getOne: vi.fn(async () => ({ id: BROADCAST_ID, broadcastStatus: "completed", createdAt: new Date() })),
        getRawMany: vi.fn(async () => rows),
      };
      const query = vi.fn(async () => recipientRows);
      const manager = {
        queryRunner: { isTransactionActive: true },
        getRepository: (entity: typeof AuditLog | typeof Broadcast) =>
          entity === AuditLog
            ? { insert: vi.fn(async () => undefined) }
            : { createQueryBuilder: () => queryBuilder },
        query,
      } as unknown as EntityManager;
      return { manager, query };
    }

    it("works out who each recipient is, in one query per page", async () => {
      const { manager, query } = setup([
        {
          personId: people.candidate,
          officeName: "Senate",
          seatName: "ANAMBRA NORTH",
          stateCode: "04",
          isRunningMate: false,
          agentKind: null,
          pollingUnitCode: null,
          pollingUnitName: null,
          ownerName: null,
        },
        {
          personId: people.runningMate,
          officeName: "Governor",
          seatName: "ANAMBRA",
          stateCode: "04",
          isRunningMate: true,
          agentKind: null,
          pollingUnitCode: null,
          pollingUnitName: null,
          ownerName: null,
        },
        {
          personId: people.official,
          officeName: null,
          seatName: null,
          stateCode: null,
          isRunningMate: null,
          agentKind: "official",
          pollingUnitCode: "04-17-01-002",
          pollingUnitName: "ALL SAINTS PRIMARY SCHOOL II",
          ownerName: "NDC Party",
        },
        {
          personId: people.extra,
          officeName: null,
          seatName: null,
          stateCode: null,
          isRunningMate: null,
          agentKind: "extra",
          pollingUnitCode: "04-17-01-024",
          pollingUnitName: "OPEN SPACE",
          ownerName: "Mobilisers",
        },
        {
          personId: people.unknown,
          officeName: null,
          seatName: null,
          stateCode: null,
          isRunningMate: null,
          agentKind: null,
          pollingUnitCode: null,
          pollingUnitName: null,
          ownerName: null,
        },
      ]);

      const page = await listBroadcastDeliveries(user, BROADCAST_ID, { limit: 50 }, manager);
      const byPerson = new Map(page?.items.map((item) => [item.personId, item.recipient]));

      expect(query).toHaveBeenCalledTimes(1);
      const [, parameters] = query.mock.calls[0] as unknown as [string, unknown[]];
      expect(parameters).toEqual([[
        people.candidate,
        people.runningMate,
        people.official,
        people.extra,
        people.unknown,
      ]]);

      expect(byPerson.get(people.candidate)).toEqual({
        kind: "candidate",
        officeName: "Senate",
        ownerName: null,
        isRunningMate: false,
        seatName: "ANAMBRA NORTH",
        stateCode: "04",
        pollingUnitCode: null,
        pollingUnitName: null,
        source: "INEC list",
      });
      expect(byPerson.get(people.runningMate)).toMatchObject({
        kind: "candidate",
        officeName: "Governor",
        isRunningMate: true,
      });
      expect(byPerson.get(people.official)).toEqual({
        kind: "official_agent",
        officeName: null,
        ownerName: "NDC Party",
        isRunningMate: false,
        seatName: null,
        stateCode: null,
        pollingUnitCode: "04-17-01-002",
        pollingUnitName: "ALL SAINTS PRIMARY SCHOOL II",
        source: null,
      });
      expect(byPerson.get(people.extra)).toMatchObject({
        kind: "extra_agent",
        ownerName: "Mobilisers",
        pollingUnitCode: "04-17-01-024",
      });
      expect(byPerson.get(people.unknown)).toMatchObject({ kind: null, source: null });
    });

    it("prefers the candidate seat when a person is both a candidate and an agent", async () => {
      const { manager } = setup([{
        personId: people.candidate,
        officeName: "Senate",
        seatName: "ANAMBRA NORTH",
        stateCode: "04",
        isRunningMate: false,
        agentKind: "official",
        pollingUnitCode: "04-17-01-002",
        pollingUnitName: "ALL SAINTS",
        ownerName: "NDC Party",
      }]);

      const page = await listBroadcastDeliveries(user, BROADCAST_ID, { limit: 50 }, manager);
      const recipient = page?.items.find((item) => item.personId === people.candidate)?.recipient;

      expect(recipient?.kind).toBe("candidate");
      expect(recipient?.pollingUnitCode).toBeNull();
    });

    it("gives an empty recipient when the lookup returns nothing for a person", async () => {
      const { manager } = setup([]);

      const page = await listBroadcastDeliveries(user, BROADCAST_ID, { limit: 50 }, manager);

      expect(page?.items.every((item) => item.recipient.kind === null)).toBe(true);
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
