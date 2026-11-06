import { parsePhoneNumberFromString } from "libphonenumber-js";
import { Brackets } from "typeorm";
import type { EntityManager, SelectQueryBuilder } from "typeorm";
import { AgentAssignment } from "../../db/entities/agent-assignment.entity";
import { AuditLog } from "../../db/entities/audit-log.entity";
import { PhoneNumber } from "../../db/entities/phone-number.entity";
import { agentFiltersSchema, agentSummaryFiltersSchema } from "../schemas";
import { InvalidFilterError } from "../errors";
import { resolveManager } from "./database";
import { decodeCursor, encodeCursor } from "./cursor";
import type { AgentCursor } from "./cursor";
import type { AgentFilters, AgentSummaryFilters } from "../schemas";
import { CONSENT_TEXT_VERSION } from "../../channels/telegram/consent-text";
import { getScope } from "./scope";
import { getVisibleOwners } from "./owners";
import type { PolicyUser } from "./policy-user";

// Mirrors the worker's Telegram eligibility: a confirmed, linked phone and accepted current consent.
const TELEGRAM_READY_SQL = `(
  EXISTS (
    SELECT 1 FROM phone_number telegram_phone
    WHERE telegram_phone.person_id = person.id
      AND telegram_phone.is_confirmed = TRUE
      AND telegram_phone.telegram_chat_id IS NOT NULL
  )
  AND COALESCE((
    SELECT telegram_consent.is_accepted FROM consent telegram_consent
    WHERE telegram_consent.person_id = person.id
      AND telegram_consent.consent_text_version = :agentConsentVersion
    ORDER BY telegram_consent.created_at DESC, telegram_consent.id DESC
    LIMIT 1
  ), FALSE)
)`;

// Mirrors the worker's SMS fallback: it needs a confirmed phone, otherwise the delivery fails.
const CONFIRMED_PHONE_SQL = `EXISTS (
  SELECT 1 FROM phone_number confirmed_phone
  WHERE confirmed_phone.person_id = person.id
    AND confirmed_phone.is_confirmed = TRUE
)`;

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
  telegramConnected: boolean;
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
  telegramConnected: boolean;
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
    .addSelect(TELEGRAM_READY_SQL, "telegramConnected")
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

  query.setParameter("agentConsentVersion", CONSENT_TEXT_VERSION);
  getScope(user).apply(query, "pollingUnit.id");
  getVisibleOwners(user).apply(query, "assignment.ownerGroupId");
  // TODO(tree-rule): apply personnel hierarchy rules when that policy is introduced.

  applyAgentFilters(query, filters);

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

export interface AgentSummary {
  total: number;
  official: number;
  extra: number;
  telegramConnected: number;
  /** smsOnly + notMatched. */
  notConnected: number;
  /** Not on Telegram, but has a confirmed number: reached by SMS. */
  smsOnly: number;
  /** No confirmed number: gets no messages. */
  notMatched: number;
}

export async function summarizeAgents(
  user: PolicyUser,
  filters: AgentSummaryFilters,
  manager?: EntityManager,
): Promise<AgentSummary> {
  const parsedFilters = agentSummaryFiltersSchema.safeParse(filters);
  if (!parsedFilters.success) {
    throw new InvalidFilterError();
  }

  const entityManager = await resolveManager(manager);
  // The scoped, filtered assignments: one row each, with the person and kind.
  const base = entityManager
    .getRepository(AgentAssignment)
    .createQueryBuilder("assignment")
    .innerJoin("assignment.person", "person")
    .innerJoin("assignment.pollingUnit", "pollingUnit")
    .innerJoin("pollingUnit.ward", "ward")
    .innerJoin("ward.lga", "lga")
    .innerJoin("lga.state", "state")
    .select("person.id", "personId")
    .addSelect("assignment.agentKind", "agentKind");

  getScope(user).apply(base, "pollingUnit.id");
  getVisibleOwners(user).apply(base, "assignment.ownerGroupId");
  applyAgentFilters(base, parsedFilters.data);

  const [baseSql, baseParameters] = base.getQueryAndParameters();
  const consentVersionParam = `$${baseParameters.length + 1}`;

  // Phone and consent status are worked out once per person, as grouped sets, and joined.
  // Doing them as per-row subqueries (as the list does for its 100-row pages) runs
  // two or three lookups for every assignment, which is far too slow at national scale.
  // The rules match TELEGRAM_READY_SQL and CONFIRMED_PHONE_SQL above.
  const rows = await entityManager.query<Array<{
    total: number | string;
    official: number | string;
    extra: number | string;
    telegramConnected: number | string;
    notMatched: number | string;
  }>>(
    `
      WITH base AS (${baseSql}),
      people AS (
        SELECT DISTINCT base."personId" AS person_id FROM base
      ),
      phone_flags AS (
        SELECT
          phone.person_id,
          BOOL_OR(phone.is_confirmed) AS has_confirmed,
          BOOL_OR(phone.is_confirmed AND phone.telegram_chat_id IS NOT NULL) AS has_telegram
        FROM phone_number phone
        JOIN people ON people.person_id = phone.person_id
        GROUP BY phone.person_id
      ),
      consent_flags AS (
        SELECT
          consent_row.person_id,
          (ARRAY_AGG(consent_row.is_accepted ORDER BY consent_row.created_at DESC, consent_row.id DESC))[1] AS accepted
        FROM consent consent_row
        JOIN people ON people.person_id = consent_row.person_id
        WHERE consent_row.consent_text_version = ${consentVersionParam}
        GROUP BY consent_row.person_id
      )
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE base."agentKind" = 'official')::int AS official,
        COUNT(*) FILTER (WHERE base."agentKind" = 'extra')::int AS extra,
        COUNT(*) FILTER (
          WHERE COALESCE(phone_flags.has_telegram, FALSE) AND COALESCE(consent_flags.accepted, FALSE)
        )::int AS "telegramConnected",
        COUNT(*) FILTER (WHERE NOT COALESCE(phone_flags.has_confirmed, FALSE))::int AS "notMatched"
      FROM base
      LEFT JOIN phone_flags ON phone_flags.person_id = base."personId"
      LEFT JOIN consent_flags ON consent_flags.person_id = base."personId";
    `,
    [...baseParameters, CONSENT_TEXT_VERSION],
  );
  const row = rows[0];
  const total = Number(row?.total ?? 0);
  const telegramConnected = Number(row?.telegramConnected ?? 0);
  const notConnected = Math.max(total - telegramConnected, 0);
  // Telegram-ready implies a confirmed phone, so everyone unmatched is also not connected.
  const notMatched = Math.min(Number(row?.notMatched ?? 0), notConnected);

  return {
    total,
    official: Number(row?.official ?? 0),
    extra: Number(row?.extra ?? 0),
    telegramConnected,
    notConnected,
    smsOnly: notConnected - notMatched,
    notMatched,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function applyAgentFilters(
  query: SelectQueryBuilder<AgentAssignment>,
  filters: Partial<AgentFilters>,
): void {
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
  if (filters.channel === "telegram") {
    query.andWhere(TELEGRAM_READY_SQL);
  } else if (filters.channel === "not_connected") {
    query.andWhere(`NOT ${TELEGRAM_READY_SQL}`);
  } else if (filters.channel === "sms_only") {
    query.andWhere(`NOT ${TELEGRAM_READY_SQL}`).andWhere(CONFIRMED_PHONE_SQL);
  } else if (filters.channel === "not_matched") {
    query.andWhere(`NOT ${CONFIRMED_PHONE_SQL}`);
  }
  if (filters.q !== undefined) {
    // Phones are masked in responses, so search covers names and places only.
    query.andWhere(
      new Brackets((where) => {
        where
          .where("person.fullName ILIKE :agentFilterSearch")
          .orWhere("pollingUnit.pollingUnitName ILIKE :agentFilterSearch")
          .orWhere("pollingUnit.inecPollingUnitCode ILIKE :agentFilterSearch")
          .orWhere("ward.wardName ILIKE :agentFilterSearch")
          .orWhere("lga.lgaName ILIKE :agentFilterSearch");
      }),
    );
    query.setParameter("agentFilterSearch", `%${escapeLike(filters.q)}%`);
  }
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
    telegramConnected: row.telegramConnected === true,
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
