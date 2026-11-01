import { parsePhoneNumberFromString } from "libphonenumber-js";
import { Brackets } from "typeorm";
import type { EntityManager, SelectQueryBuilder } from "typeorm";
import { AgentAssignment } from "../../db/entities/agent-assignment.entity";
import { AuditLog } from "../../db/entities/audit-log.entity";
import { PhoneNumber } from "../../db/entities/phone-number.entity";
import { agentFiltersSchema } from "../schemas";
import { InvalidFilterError } from "../errors";
import { resolveManager } from "./database";
import { decodeCursor, encodeCursor } from "./cursor";
import type { AgentCursor } from "./cursor";
import type { AgentFilters } from "../schemas";
import { getScope } from "./scope";
import { getVisibleOwners } from "./owners";
import type { PolicyUser } from "./policy-user";

export interface AgentListContext {
  ipAddress?: string | null;
}

export interface AgentDto {
  assignmentId: string;
  agentKind: string;
  slotNumber: number;
  personId: string;
  fullName: string;
  maskedPhone: string | null;
  pollingUnit: {
    id: number;
    inecPollingUnitCode: string;
    name: string | null;
    wardName: string;
    lgaName: string;
    stateName: string;
  };
  owner: {
    type: "group" | "candidate";
    id: number;
    displayName: string;
  };
}

export interface AgentPage {
  items: AgentDto[];
  nextCursor: string | null;
}

interface AgentRawRow {
  assignmentId: string;
  agentKind: string;
  slotNumber: number;
  personId: string;
  fullName: string;
  phoneNumber: string | null;
  pollingUnitId: number;
  pollingUnitCode: string;
  pollingUnitName: string | null;
  wardName: string;
  lgaName: string;
  stateName: string;
  ownerType: "group" | "candidate";
  ownerId: number;
  ownerDisplayName: string;
}

export function validateAgentFilters(user: PolicyUser, filters: AgentFilters): void {
  // ASSUMPTION: non-admin candidates cannot use LGA filters; they can filter by political unit or ward.
  if (user.candidateId !== null && !user.isAdmin && filters.lgaId !== undefined) {
    throw new InvalidFilterError();
  }
}

export function maskPhoneNumber(phoneNumber: string | null): string | null {
  if (!phoneNumber) {
    return null;
  }

  const parsed = parsePhoneNumberFromString(phoneNumber);
  if (!parsed) {
    return null;
  }

  const nationalDigits = parsed.nationalNumber;
  const visibleDigits = nationalDigits.slice(-4);
  const maskedDigits = "*".repeat(Math.max(0, nationalDigits.length - visibleDigits.length));
  return `+${parsed.countryCallingCode}${maskedDigits}${visibleDigits}`;
}

export async function listAgents(
  user: PolicyUser,
  filters: AgentFilters,
  context?: AgentListContext,
  manager?: EntityManager,
): Promise<AgentPage> {
  const parsedFilters = agentFiltersSchema.safeParse(filters);
  if (!parsedFilters.success) {
    throw new InvalidFilterError();
  }
  validateAgentFilters(user, parsedFilters.data);

  const entityManager = await resolveManager(manager);
  const execute = (transactionManager: EntityManager) =>
    queryAgents(transactionManager, user, parsedFilters.data, context);

  if (entityManager.queryRunner?.isTransactionActive) {
    return execute(entityManager);
  }
  return entityManager.transaction(execute);
}

async function queryAgents(
  manager: EntityManager,
  user: PolicyUser,
  filters: AgentFilters,
  context?: AgentListContext,
): Promise<AgentPage> {
  const query = manager
    .getRepository(AgentAssignment)
    .createQueryBuilder("assignment")
    .innerJoin("assignment.person", "person")
    .innerJoin("assignment.pollingUnit", "pollingUnit")
    .innerJoin("pollingUnit.ward", "ward")
    .innerJoin("ward.lga", "lga")
    .innerJoin("lga.state", "state")
    .leftJoin("assignment.ownerGroup", "ownerGroup")
    .leftJoin("assignment.ownerCandidate", "ownerCandidate")
    .leftJoin("ownerCandidate.person", "ownerCandidatePerson")
    .select("assignment.id", "assignmentId")
    .addSelect("assignment.agentKind", "agentKind")
    .addSelect("assignment.slotNumber", "slotNumber")
    .addSelect("person.id", "personId")
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
    .addSelect("pollingUnit.id", "pollingUnitId")
    .addSelect("pollingUnit.inecPollingUnitCode", "pollingUnitCode")
    .addSelect("pollingUnit.pollingUnitName", "pollingUnitName")
    .addSelect("ward.wardName", "wardName")
    .addSelect("lga.lgaName", "lgaName")
    .addSelect("state.stateName", "stateName")
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
    );

  getScope(user).apply(query, "pollingUnit.id");
  getVisibleOwners(user).apply(query, "assignment.ownerGroupId");
  // TODO(tree-rule): apply personnel hierarchy rules when that policy is introduced.

  if (filters.stateId !== undefined) {
    query.andWhere("state.id = :agentFilterStateId", {
      agentFilterStateId: filters.stateId,
    });
  }
  if (filters.lgaId !== undefined) {
    query.andWhere("lga.id = :agentFilterLgaId", {
      agentFilterLgaId: filters.lgaId,
    });
  }
  if (filters.wardId !== undefined) {
    query.andWhere("ward.id = :agentFilterWardId", {
      agentFilterWardId: filters.wardId,
    });
  }
  if (filters.politicalUnitId !== undefined) {
    query.andWhere(
      `EXISTS (
        SELECT 1
        FROM pu_political_unit filter_political_mapping
        WHERE filter_political_mapping.polling_unit_id = pollingUnit.id
          AND filter_political_mapping.political_unit_id = :agentFilterPoliticalUnitId
      )`,
      { agentFilterPoliticalUnitId: filters.politicalUnitId },
    );
  }
  if (filters.ownerGroupId !== undefined) {
    query.andWhere("assignment.ownerGroupId = :agentFilterOwnerGroupId", {
      agentFilterOwnerGroupId: filters.ownerGroupId,
    });
  }
  if (filters.ownerCandidateId !== undefined) {
    query.andWhere("assignment.ownerCandidateId = :agentFilterOwnerCandidateId", {
      agentFilterOwnerCandidateId: filters.ownerCandidateId,
    });
  }
  if (filters.agentKind !== undefined) {
    query.andWhere("assignment.agentKind = :agentFilterAgentKind", {
      agentFilterAgentKind: filters.agentKind,
    });
  }

  const cursor = filters.cursor ? decodeCursor(filters.cursor) : null;
  if (cursor) {
    applyCursor(query, cursor);
  }

  // Candidates must not get bulk export; the schema caps every page at 100.
  const rawRows = await query
    .orderBy("pollingUnit.inecPollingUnitCode", "ASC")
    .addOrderBy("assignment.slotNumber", "ASC")
    .addOrderBy("assignment.id", "ASC")
    .limit(filters.limit + 1)
    .getRawMany<AgentRawRow>();

  const hasNextPage = rawRows.length > filters.limit;
  const pageRows = hasNextPage ? rawRows.slice(0, filters.limit) : rawRows;
  const items = pageRows.map(toAgentDto);
  const lastRow = pageRows.at(-1);
  const nextCursor = hasNextPage && lastRow
    ? encodeCursor({
        pollingUnitCode: lastRow.pollingUnitCode,
        slotNumber: Number(lastRow.slotNumber),
        assignmentId: lastRow.assignmentId,
      })
    : null;

  await manager.getRepository(AuditLog).insert({
    actorPersonId: user.personId,
    actionType: "view_agents",
    targetEntityType: null,
    targetEntityId: null,
    ipAddress: context?.ipAddress ?? null,
  });

  return { items, nextCursor };
}

function applyCursor(
  query: SelectQueryBuilder<AgentAssignment>,
  cursor: AgentCursor,
): void {
  query.andWhere(
    new Brackets((where) => {
      where
        .where("pollingUnit.inecPollingUnitCode > :agentCursorCode", {
          agentCursorCode: cursor.pollingUnitCode,
        })
        .orWhere(
          "pollingUnit.inecPollingUnitCode = :agentCursorCode AND assignment.slotNumber > :agentCursorSlot",
          {
            agentCursorCode: cursor.pollingUnitCode,
            agentCursorSlot: cursor.slotNumber,
          },
        )
        .orWhere(
          `pollingUnit.inecPollingUnitCode = :agentCursorCode
           AND assignment.slotNumber = :agentCursorSlot
           AND assignment.id > :agentCursorAssignmentId`,
          {
            agentCursorCode: cursor.pollingUnitCode,
            agentCursorSlot: cursor.slotNumber,
            agentCursorAssignmentId: cursor.assignmentId,
          },
        );
    }),
  );
}

function toAgentDto(row: AgentRawRow): AgentDto {
  return {
    assignmentId: row.assignmentId,
    agentKind: row.agentKind,
    slotNumber: Number(row.slotNumber),
    personId: row.personId,
    fullName: row.fullName,
    maskedPhone: maskPhoneNumber(row.phoneNumber),
    pollingUnit: {
      id: Number(row.pollingUnitId),
      inecPollingUnitCode: row.pollingUnitCode,
      name: row.pollingUnitName,
      wardName: row.wardName,
      lgaName: row.lgaName,
      stateName: row.stateName,
    },
    owner: {
      type: row.ownerType,
      id: Number(row.ownerId),
      displayName: row.ownerDisplayName,
    },
  };
}
