import { z } from "zod";
import type { EntityManager } from "typeorm";
import { AgentAssignment } from "../../db/entities/agent-assignment.entity";
import { AuditLog } from "../../db/entities/audit-log.entity";
import { PhoneNumber } from "../../db/entities/phone-number.entity";
import { PollingUnit } from "../../db/entities/polling-unit.entity";
import { InvalidFilterError } from "../errors";
import { resolveManager } from "./database";
import { getScope } from "./scope";
import { getVisibleOwners } from "./owners";
import { loadPolicyUser, type PolicyUser } from "./policy-user";
import { maskPhoneNumber } from "./list-agents";
import { gpsFilterSchema, gpsFilterSql, hasGpsSql } from "../../geography/gps";

const cursorPayloadSchema = z.object({
  pollingUnitCode: z.string().min(1).max(128),
  gps: gpsFilterSchema.optional(),
}).strict();

const cursorSchema = z.string().max(512).refine((value) => {
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    return Buffer.from(json, "utf8").toString("base64url") === value &&
      cursorPayloadSchema.safeParse(JSON.parse(json)).success;
  } catch {
    return false;
  }
});

export const wardPollingUnitsQuerySchema = z.object({
  cursor: cursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  gps: gpsFilterSchema,
}).strict();

export type WardPollingUnitsQuery = z.input<typeof wardPollingUnitsQuerySchema>;

export interface WardPollingUnitAgent {
  assignmentId: string;
  agentKind: "official" | "extra";
  slotNumber: number;
  fullName: string;
  maskedPhone: string | null;
  owner: {
    type: "group" | "candidate";
    id: number;
    displayName: string;
  };
}

export interface WardPollingUnit {
  id: number;
  code: string;
  name: string;
  wardCode: string;
  lgaCode: string;
  stateCode: string;
  latitude: number | null;
  longitude: number | null;
  hasGPS: boolean;
  hasGps: boolean;
  hasOfficialAgent: boolean;
  agents: WardPollingUnitAgent[];
}

export interface WardPollingUnitsPage {
  items: WardPollingUnit[];
  nextCursor: string | null;
}

export interface WardPollingUnitsContext {
  ipAddress?: string | null;
  /** Use this access instead of the person's own (set while "View as" is on). */
  user?: PolicyUser;
}

interface PollingUnitRow {
  id: number;
  code: string;
  name: string | null;
  wardCode: string;
  lgaCode: string;
  stateCode: string;
  latitude: number | null;
  longitude: number | null;
  hasGps: boolean;
}

interface AgentRow {
  pollingUnitId: number;
  assignmentId: string;
  agentKind: "official" | "extra";
  slotNumber: number;
  fullName: string;
  phoneNumber: string | null;
  ownerType: "group" | "candidate";
  ownerId: number;
  ownerDisplayName: string;
}

function encodeCursor(pollingUnitCode: string, gps: "all" | "with" | "without"): string {
  return Buffer.from(JSON.stringify({ pollingUnitCode, gps }), "utf8").toString("base64url");
}

function decodeCursor(cursor: string, gps: "all" | "with" | "without"): string {
  const parsed = cursorSchema.safeParse(cursor);
  if (!parsed.success) {
    throw new InvalidFilterError();
  }

  const json = Buffer.from(cursor, "base64url").toString("utf8");
  const payload = cursorPayloadSchema.parse(JSON.parse(json));
  if ((payload.gps ?? "all") !== gps) {
    throw new InvalidFilterError();
  }
  return payload.pollingUnitCode;
}

export async function listWardPollingUnits(
  personId: string,
  wardId: number,
  filters: WardPollingUnitsQuery,
  context?: WardPollingUnitsContext,
  manager?: EntityManager,
): Promise<WardPollingUnitsPage | null> {
  const parsedFilters = wardPollingUnitsQuerySchema.safeParse(filters);
  if (!parsedFilters.success) {
    throw new InvalidFilterError();
  }

  const entityManager = await resolveManager(manager);
  const execute = async (transactionManager: EntityManager) => {
    const user = context?.user ?? await loadPolicyUser(personId, transactionManager);
    const scope = getScope(user, transactionManager);
    const wardScopeQuery = transactionManager
      .getRepository(PollingUnit)
      .createQueryBuilder("pollingUnit")
      .select("pollingUnit.id", "id")
      .where("pollingUnit.wardId = :wardPollingUnitsWardId", {
        wardPollingUnitsWardId: wardId,
      });

    scope.apply(wardScopeQuery, "pollingUnit.id");
    const scopedWard = await wardScopeQuery.getRawOne<{ id: number }>();
    if (!scopedWard) {
      await writeViewAudit(transactionManager, personId, wardId, context?.ipAddress);
      return null;
    }

    const pollingUnitQuery = transactionManager
      .getRepository(PollingUnit)
      .createQueryBuilder("pollingUnit")
      .innerJoin("pollingUnit.ward", "ward")
      .innerJoin("ward.lga", "lga")
      .innerJoin("lga.state", "state")
      .select("pollingUnit.id", "id")
      .addSelect("pollingUnit.inecPollingUnitCode", "code")
      .addSelect("pollingUnit.pollingUnitName", "name")
      .addSelect("ward.inecWardCode", "wardCode")
      .addSelect("lga.inecLgaCode", "lgaCode")
      .addSelect("state.inecStateCode", "stateCode")
      .addSelect("pollingUnit.latitude", "latitude")
      .addSelect("pollingUnit.longitude", "longitude")
      .addSelect(hasGpsSql("pollingUnit"), "hasGps")
      .where("pollingUnit.wardId = :wardPollingUnitsWardId", {
        wardPollingUnitsWardId: wardId,
      });
    scope.apply(pollingUnitQuery, "pollingUnit.id");

    const gpsClause = gpsFilterSql(parsedFilters.data.gps, "pollingUnit");
    if (gpsClause) {
      pollingUnitQuery.andWhere(gpsClause);
    }

    if (parsedFilters.data.cursor) {
      pollingUnitQuery.andWhere(
        "pollingUnit.inecPollingUnitCode > :wardPollingUnitsCursor",
        { wardPollingUnitsCursor: decodeCursor(parsedFilters.data.cursor, parsedFilters.data.gps) },
      );
    }

    const rawPollingUnits = await pollingUnitQuery
      .orderBy("pollingUnit.inecPollingUnitCode", "ASC")
      .limit(parsedFilters.data.limit + 1)
      .getRawMany<PollingUnitRow>();
    const hasNextPage = rawPollingUnits.length > parsedFilters.data.limit;
    const pollingUnits = hasNextPage
      ? rawPollingUnits.slice(0, parsedFilters.data.limit)
      : rawPollingUnits;
    const unitIds = pollingUnits.map((pollingUnit) => Number(pollingUnit.id));
    const agentsByPollingUnit = new Map<number, WardPollingUnitAgent[]>();

    if (unitIds.length > 0) {
      const agentQuery = transactionManager
        .getRepository(AgentAssignment)
        .createQueryBuilder("assignment")
        .innerJoin("assignment.person", "person")
        .innerJoin("assignment.pollingUnit", "pollingUnit")
        .leftJoin("assignment.ownerGroup", "ownerGroup")
        .leftJoin("assignment.ownerCandidate", "ownerCandidate")
        .leftJoin("ownerCandidate.person", "ownerCandidatePerson")
        .select("pollingUnit.id", "pollingUnitId")
        .addSelect("assignment.id", "assignmentId")
        .addSelect("assignment.agentKind", "agentKind")
        .addSelect("assignment.slotNumber", "slotNumber")
        .addSelect("person.fullName", "fullName")
        .addSelect(
          (subquery) =>
            subquery
              .select("phone.e164Number")
              .from(PhoneNumber, "phone")
              .where("phone.personId = person.id")
              .orderBy("phone.isConfirmed", "DESC")
              .addOrderBy("phone.createdAt", "ASC")
              .addOrderBy("phone.id", "ASC")
              .limit(1),
          "phoneNumber",
        )
        .addSelect(
          "CASE WHEN assignment.ownerGroupId IS NULL THEN 'candidate' ELSE 'group' END",
          "ownerType",
        )
        .addSelect(
          "COALESCE(assignment.ownerCandidateId, assignment.ownerGroupId)",
          "ownerId",
        )
        .addSelect(
          "COALESCE(ownerCandidatePerson.fullName, ownerGroup.groupName)",
          "ownerDisplayName",
        )
        .where("pollingUnit.id IN (:...wardPollingUnitsIds)", {
          wardPollingUnitsIds: unitIds,
        })
        .orderBy(
          "CASE WHEN assignment.agentKind = 'official' THEN 0 ELSE 1 END",
          "ASC",
        )
        .addOrderBy("assignment.slotNumber", "ASC")
        .addOrderBy("assignment.id", "ASC");

      const visibleScope = getScope(user, transactionManager);
      const visibleOwners = getVisibleOwners(user, transactionManager);
      visibleScope.apply(agentQuery, "pollingUnit.id");
      visibleOwners.apply(agentQuery, "assignment.ownerGroupId");

      const agentRows = await agentQuery.getRawMany<AgentRow>();
      for (const row of agentRows) {
        const pollingUnitId = Number(row.pollingUnitId);
        const agents = agentsByPollingUnit.get(pollingUnitId) ?? [];
        agents.push({
          assignmentId: row.assignmentId,
          agentKind: row.agentKind,
          slotNumber: Number(row.slotNumber),
          fullName: row.fullName,
          maskedPhone: maskPhoneNumber(row.phoneNumber),
          owner: {
            type: row.ownerType,
            id: Number(row.ownerId),
            displayName: row.ownerDisplayName,
          },
        });
        agentsByPollingUnit.set(pollingUnitId, agents);
      }
    }

    const lastPollingUnit = pollingUnits.at(-1);
    const page = {
      items: pollingUnits.map((pollingUnit) => {
        const agents = agentsByPollingUnit.get(Number(pollingUnit.id)) ?? [];
        return {
          id: Number(pollingUnit.id),
          code: pollingUnit.code,
          name: pollingUnit.name ?? "Unnamed PU",
          wardCode: pollingUnit.wardCode,
          lgaCode: pollingUnit.lgaCode,
          stateCode: pollingUnit.stateCode,
          latitude: pollingUnit.latitude,
          longitude: pollingUnit.longitude,
          hasGPS: pollingUnit.hasGps,
          hasGps: pollingUnit.hasGps,
          hasOfficialAgent: agents.some((agent) => agent.agentKind === "official"),
          agents,
        };
      }),
      nextCursor: hasNextPage && lastPollingUnit
        ? encodeCursor(lastPollingUnit.code, parsedFilters.data.gps)
        : null,
    };

    await writeViewAudit(transactionManager, personId, wardId, context?.ipAddress);
    return page;
  };

  if (entityManager.queryRunner?.isTransactionActive) {
    return execute(entityManager);
  }
  return entityManager.transaction(execute);
}

async function writeViewAudit(
  manager: EntityManager,
  personId: string,
  wardId: number,
  ipAddress?: string | null,
): Promise<void> {
  await manager.getRepository(AuditLog).insert({
    actorPersonId: personId,
    actionType: "view_ward_polling_units",
    targetEntityType: "ward",
    targetEntityId: String(wardId),
    ipAddress: ipAddress ?? null,
  });
}
