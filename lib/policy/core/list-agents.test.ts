import { describe, expect, it, vi } from "vitest";
import type { EntityManager } from "typeorm";
import { AgentAssignment } from "../../db/entities/agent-assignment.entity";
import { AuditLog } from "../../db/entities/audit-log.entity";
import { listAgents, maskPhoneNumber, summarizeAgents, validateAgentFilters } from "./list-agents";
import { CONSENT_TEXT_VERSION } from "../../channels/telegram/consent-text";
import { InvalidFilterError } from "../errors";
import { agentFiltersSchema, agentSummaryFiltersSchema } from "../schemas";
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
  it("accepts search and channel filters and rejects unknown channels", () => {
    expect(agentFiltersSchema.parse({ q: "  ikeja ", channel: "telegram" })).toMatchObject({
      q: "ikeja",
      channel: "telegram",
    });
    expect(agentFiltersSchema.safeParse({ channel: "sms" }).success).toBe(false);
    expect(agentFiltersSchema.parse({ channel: "sms_only" }).channel).toBe("sms_only");
    expect(agentFiltersSchema.parse({ channel: "not_matched" }).channel).toBe("not_matched");
    expect(agentSummaryFiltersSchema.safeParse({ cursor: "x" }).success).toBe(false);
  });

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
      setParameter: vi.fn().mockReturnThis(),
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

/** A query builder that records its WHERE clauses; enough for listAgents and summarizeAgents. */
// Any function is accepted: every member is a vi.fn mock.
type RecordingBuilder = Record<string, (...args: never[]) => unknown>;

function recordingQueryBuilder(baseSql = "SELECT base_rows", baseParameters: unknown[] = []) {
  const whereClauses: string[] = [];
  // Typed up front because andWhere returns the builder itself.
  const builder: RecordingBuilder = {
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    setParameter: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn((clause: unknown): RecordingBuilder => {
      if (typeof clause === "string") whereClauses.push(clause);
      return builder;
    }),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    getRawMany: vi.fn(async () => []),
    getQueryAndParameters: vi.fn(() => [baseSql, baseParameters]),
  };
  return { builder, whereClauses };
}

function managerFor(builder: unknown, query = vi.fn()) {
  return {
    queryRunner: { isTransactionActive: true },
    getRepository: (entity: typeof AgentAssignment | typeof AuditLog) =>
      entity === AuditLog
        ? { insert: vi.fn(async () => undefined) }
        : { createQueryBuilder: () => builder },
    query,
  } as unknown as EntityManager;
}

describe("agent channel filters", () => {
  it("sms_only keeps people off Telegram who have a confirmed number", async () => {
    const { builder, whereClauses } = recordingQueryBuilder();
    await listAgents(adminUser, { channel: "sms_only", limit: 50 }, undefined, managerFor(builder));

    expect(whereClauses.some((clause) => clause.startsWith("NOT (") && clause.includes("telegram_phone"))).toBe(true);
    expect(whereClauses.some((clause) => !clause.startsWith("NOT") && clause.includes("confirmed_phone"))).toBe(true);
  });

  it("not_matched keeps people with no confirmed number", async () => {
    const { builder, whereClauses } = recordingQueryBuilder();
    await listAgents(adminUser, { channel: "not_matched", limit: 50 }, undefined, managerFor(builder));

    expect(whereClauses.some((clause) => clause.startsWith("NOT EXISTS") && clause.includes("confirmed_phone"))).toBe(true);
    expect(whereClauses.some((clause) => clause.includes("telegram_phone"))).toBe(false);
  });
});

describe("summarizeAgents", () => {
  it("splits not connected into SMS only and not matched", async () => {
    const { builder } = recordingQueryBuilder();
    const query = vi.fn(async () => [{
      total: 10,
      official: 4,
      extra: 6,
      telegramConnected: 6,
      notMatched: 1,
    }]);

    const summary = await summarizeAgents(adminUser, {}, managerFor(builder, query));

    expect(summary).toEqual({
      total: 10,
      official: 4,
      extra: 6,
      telegramConnected: 6,
      notConnected: 4,
      smsOnly: 3,
      notMatched: 1,
    });
    expect(summary.smsOnly + summary.notMatched).toBe(summary.notConnected);
  });

  it("never reports more unmatched people than are off Telegram", async () => {
    const { builder } = recordingQueryBuilder();
    const query = vi.fn(async () => [{
      total: 5,
      official: 5,
      extra: 0,
      telegramConnected: 4,
      notMatched: 3,
    }]);

    const summary = await summarizeAgents(adminUser, {}, managerFor(builder, query));

    expect(summary.notConnected).toBe(1);
    expect(summary.notMatched).toBe(1);
    expect(summary.smsOnly).toBe(0);
  });

  it("returns zeros when there are no rows", async () => {
    const { builder } = recordingQueryBuilder();
    const summary = await summarizeAgents(adminUser, {}, managerFor(builder, vi.fn(async () => [])));

    expect(summary).toEqual({
      total: 0,
      official: 0,
      extra: 0,
      telegramConnected: 0,
      notConnected: 0,
      smsOnly: 0,
      notMatched: 0,
    });
  });

  it("works out phone and consent once per person in a single query, not per row", async () => {
    const { builder } = recordingQueryBuilder("SELECT base_rows WHERE name ILIKE $1", ["%ikeja%"]);
    const query = vi.fn(async () => [{ total: 0, official: 0, extra: 0, telegramConnected: 0, notMatched: 0 }]);

    await summarizeAgents(adminUser, { q: "ikeja" }, managerFor(builder, query));

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, parameters] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("WITH base AS (SELECT base_rows WHERE name ILIKE $1)");
    expect(sql).toContain("GROUP BY phone.person_id");
    expect(sql).toContain("GROUP BY consent_row.person_id");
    // The consent version is bound after the filter parameters.
    expect(sql).toContain("consent_row.consent_text_version = $2");
    expect(parameters).toEqual(["%ikeja%", CONSENT_TEXT_VERSION]);
    // The per-row correlated lookups used by the list must not appear in the summary.
    expect(sql).not.toContain("telegram_phone");
    expect(sql).not.toContain("confirmed_phone");
    expect(sql).not.toContain("LIMIT 1");
  });
});
