import { Brackets } from "typeorm";
import type { EntityManager, ObjectLiteral, SelectQueryBuilder } from "typeorm";
import { AuditLog } from "../db/entities/audit-log.entity";
import { Broadcast } from "../db/entities/broadcast.entity";
import { Delivery } from "../db/entities/delivery.entity";
import { PhoneNumber } from "../db/entities/phone-number.entity";
import { maskPhoneNumber } from "../policy/core/list-agents";
import { resolveManager } from "../policy/core/database";
import type { PolicyUser } from "../policy/core/policy-user";

const MAX_MESSAGE_TEXT = 200;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface BroadcastCursor {
  createdAt: string;
  id: string;
}

export interface BroadcastListItem {
  id: string;
  status: string;
  title: string;
  messageText: string;
  sender: { id: string; displayName: string };
  audienceSummary: string[];
  deliveryCounts: DeliveryCounts;
  scheduledSendAt: Date | null;
  createdAt: Date;
}

export interface DeliveryCounts {
  pending: number;
  sent: number;
  delivered: number;
  deliveredBySms: number;
  failed: number;
  tappedOk: number;
}

export interface BroadcastPage {
  items: BroadcastListItem[];
  nextCursor: string | null;
}

export type BroadcastDetail = Omit<BroadcastListItem, "messageText"> & {
  messageText: string;
};

/**
 * Who the recipient is, worked out from what they are now (not stored on the delivery):
 * a candidate or running mate through their seat, otherwise an agent through their assignment.
 */
export interface DeliveryRecipient {
  kind: "candidate" | "official_agent" | "extra_agent" | null;
  /** Office for candidates ("Senate"), owner group or candidate name for extra agents. */
  officeName: string | null;
  ownerName: string | null;
  isRunningMate: boolean;
  /** Seat constituency for candidates; null for agents. */
  seatName: string | null;
  stateCode: string | null;
  /** Polling unit for agents; null for candidates. */
  pollingUnitCode: string | null;
  pollingUnitName: string | null;
  /** Where the record comes from: "INEC list" for candidates, null when unknown. */
  source: string | null;
}

export interface DeliveryListItem {
  id: string;
  personId: string;
  fullName: string;
  maskedPhone: string | null;
  channel: string;
  status: string;
  sentAt: Date | null;
  deliveredAt: Date | null;
  tappedOkAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  recipient: DeliveryRecipient;
}

export interface DeliveryPage {
  items: DeliveryListItem[];
  nextCursor: string | null;
}

/**
 * created_at as text with all six decimal places. Postgres keeps microseconds, but a JavaScript
 * Date keeps only milliseconds; a cursor built from a Date never matched rows sharing one
 * created_at (every delivery of a broadcast is inserted at once), so paging stopped after the
 * first batch.
 */
const exactCreatedAtSql = (alias: string) =>
  `to_char(${alias}.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

function encodeCursor(cursor: BroadcastCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string): BroadcastCursor | null {
  if (!value || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<BroadcastCursor>;
    if (
      typeof parsed.createdAt !== "string" ||
      Number.isNaN(Date.parse(parsed.createdAt)) ||
      typeof parsed.id !== "string" ||
      !UUID_PATTERN.test(parsed.id)
    ) {
      return null;
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

type AudienceIds = {
  stateId?: number;
  lgaId?: number;
  wardId?: number;
  politicalUnitId?: number;
  officeId?: number;
  ownerGroupId?: number;
  agentKind?: "official" | "extra" | "all";
};

function getAudienceIds(filter: Record<string, unknown>): AudienceIds {
  const result: AudienceIds = {};
  for (const key of [
    "stateId",
    "lgaId",
    "wardId",
    "politicalUnitId",
    "officeId",
    "ownerGroupId",
  ] as const) {
    const value = filter[key];
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
      result[key] = value;
    }
  }
  const agentKind = filter.agentKind;
  if (agentKind === "official" || agentKind === "extra" || agentKind === "all") {
    result.agentKind = agentKind;
  }
  return result;
}

async function resolveAudienceSummaries(
  filters: Record<string, unknown>[],
  manager: EntityManager,
): Promise<string[][]> {
  const ids = filters.map(getAudienceIds);
  const idLists = {
    states: [...new Set(ids.flatMap((filter) => filter.stateId ?? []))],
    lgas: [...new Set(ids.flatMap((filter) => filter.lgaId ?? []))],
    wards: [...new Set(ids.flatMap((filter) => filter.wardId ?? []))],
    politicalUnits: [...new Set(ids.flatMap((filter) => filter.politicalUnitId ?? []))],
    offices: [...new Set(ids.flatMap((filter) => filter.officeId ?? []))],
    groups: [...new Set(ids.flatMap((filter) => filter.ownerGroupId ?? []))],
  };
  const names = await manager.query<Array<{ kind: string; id: number; name: string }>>(
    `
      SELECT 'state' AS kind, id, state_name AS name FROM state WHERE id = ANY($1::int[])
      UNION ALL
      SELECT 'lga' AS kind, id, lga_name AS name FROM lga WHERE id = ANY($2::int[])
      UNION ALL
      SELECT 'ward' AS kind, id, ward_name AS name FROM ward WHERE id = ANY($3::int[])
      UNION ALL
      SELECT 'politicalUnit' AS kind, id, political_unit_name AS name
        FROM political_unit WHERE id = ANY($4::int[])
      UNION ALL
      SELECT 'office' AS kind, id, office_name AS name FROM office WHERE id = ANY($5::int[])
      UNION ALL
      SELECT 'ownerGroup' AS kind, id, group_name AS name FROM groups WHERE id = ANY($6::int[]);
    `,
    [
      idLists.states,
      idLists.lgas,
      idLists.wards,
      idLists.politicalUnits,
      idLists.offices,
      idLists.groups,
    ],
  );
  const nameById = new Map(names.map((row) => [`${row.kind}:${row.id}`, row.name]));

  return ids.map((filter) => {
    const summary: string[] = [];
    for (const key of [
      "stateId",
      "lgaId",
      "wardId",
      "politicalUnitId",
      "officeId",
      "ownerGroupId",
    ] as const) {
      const value = filter[key];
      if (value !== undefined) {
        const name = nameById.get(`${key === "ownerGroupId" ? "ownerGroup" : key.slice(0, -2)}:${value}`);
        if (name) summary.push(name);
      }
    }
    if (filter.agentKind === "official") summary.push("Official agents");
    if (filter.agentKind === "extra") summary.push("Extra agents");
    if (summary.length === 0) summary.push("All accessible agents");
    return summary;
  });
}

function mapDeliveryCounts(row?: {
  pending: number | string;
  sent: number | string;
  delivered: number | string;
  deliveredBySms: number | string;
  failed: number | string;
  tappedOk: number | string;
}): DeliveryCounts {
  return {
    pending: Number(row?.pending ?? 0),
    sent: Number(row?.sent ?? 0),
    delivered: Number(row?.delivered ?? 0),
    deliveredBySms: Number(row?.deliveredBySms ?? 0),
    failed: Number(row?.failed ?? 0),
    tappedOk: Number(row?.tappedOk ?? 0),
  };
}

function getBroadcastTitle(messageText: string): string {
  return Array.from(messageText).slice(0, 60).join("").trim();
}

const EMPTY_RECIPIENT: DeliveryRecipient = {
  kind: null,
  officeName: null,
  ownerName: null,
  isRunningMate: false,
  seatName: null,
  stateCode: null,
  pollingUnitCode: null,
  pollingUnitName: null,
  source: null,
};

/** One query for a page of recipients: their candidate seat (if any) and agent assignment (if any). */
async function resolveDeliveryRecipients(
  personIds: string[],
  manager: EntityManager,
): Promise<Map<string, DeliveryRecipient>> {
  if (personIds.length === 0) return new Map();
  const rows = await manager.query<Array<{
    personId: string;
    officeName: string | null;
    seatName: string | null;
    stateCode: string | null;
    isRunningMate: boolean | null;
    agentKind: string | null;
    pollingUnitCode: string | null;
    pollingUnitName: string | null;
    ownerName: string | null;
  }>>(
    `
      SELECT
        ids.person_id AS "personId",
        cand.office_name AS "officeName",
        cand.seat_name AS "seatName",
        cand.state_code AS "stateCode",
        cand.is_running_mate AS "isRunningMate",
        asg.agent_kind AS "agentKind",
        asg.pu_code AS "pollingUnitCode",
        asg.pu_name AS "pollingUnitName",
        asg.owner_name AS "ownerName"
      FROM unnest($1::uuid[]) AS ids(person_id)
      LEFT JOIN LATERAL (
        SELECT
          o.office_name,
          pun.political_unit_name AS seat_name,
          (c.principal_candidate_id IS NOT NULL) AS is_running_mate,
          (
            SELECT s2.inec_state_code
            FROM pu_political_unit ppu2
            JOIN polling_unit pu2 ON pu2.id = ppu2.polling_unit_id
            JOIN ward w2 ON w2.id = pu2.ward_id
            JOIN lga l2 ON l2.id = w2.lga_id
            JOIN state s2 ON s2.id = l2.state_id
            WHERE ppu2.political_unit_id = pun.id AND pun.political_unit_type <> 'country'
            LIMIT 1
          ) AS state_code
        FROM candidate c
        LEFT JOIN candidate principal ON principal.id = c.principal_candidate_id
        JOIN seat st ON st.id = COALESCE(c.seat_id, principal.seat_id)
        JOIN office o ON o.id = st.office_id
        JOIN political_unit pun ON pun.id = st.political_unit_id
        WHERE c.person_id = ids.person_id
        ORDER BY c.id
        LIMIT 1
      ) cand ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          aa.agent_kind::text AS agent_kind,
          pu.inec_polling_unit_code AS pu_code,
          pu.polling_unit_name AS pu_name,
          COALESCE(g.group_name, owner_person.full_name) AS owner_name
        FROM agent_assignment aa
        JOIN polling_unit pu ON pu.id = aa.polling_unit_id
        LEFT JOIN groups g ON g.id = aa.owner_group_id
        LEFT JOIN candidate oc ON oc.id = aa.owner_candidate_id
        LEFT JOIN person owner_person ON owner_person.id = oc.person_id
        WHERE aa.person_id = ids.person_id
        ORDER BY (aa.agent_kind = 'official') DESC, aa.created_at, aa.id
        LIMIT 1
      ) asg ON TRUE;
    `,
    [personIds],
  );

  return new Map(rows.map((row): [string, DeliveryRecipient] => {
    if (row.officeName) {
      return [row.personId, {
        ...EMPTY_RECIPIENT,
        kind: "candidate",
        officeName: row.officeName,
        isRunningMate: Boolean(row.isRunningMate),
        seatName: row.seatName,
        stateCode: row.stateCode,
        source: "INEC list",
      }];
    }
    if (row.agentKind) {
      return [row.personId, {
        ...EMPTY_RECIPIENT,
        kind: row.agentKind === "official" ? "official_agent" : "extra_agent",
        ownerName: row.ownerName,
        pollingUnitCode: row.pollingUnitCode,
        pollingUnitName: row.pollingUnitName,
      }];
    }
    return [row.personId, EMPTY_RECIPIENT];
  }));
}

async function listDeliveryCounts(
  broadcastIds: string[],
  manager: EntityManager,
): Promise<Map<string, DeliveryCounts>> {
  if (broadcastIds.length === 0) return new Map();
  const rows = await manager.query<Array<{
    broadcastId: string;
    pending: number | string;
    sent: number | string;
    delivered: number | string;
    deliveredBySms: number | string;
    failed: number | string;
    tappedOk: number | string;
  }>>(
    `
      SELECT
        broadcast_id AS "broadcastId",
        COUNT(*) FILTER (WHERE delivery_status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE delivery_status = 'sent')::int AS sent,
        COUNT(*) FILTER (WHERE delivery_status = 'delivered')::int AS delivered,
        COUNT(*) FILTER (WHERE delivery_status = 'delivered_by_sms')::int AS "deliveredBySms",
        COUNT(*) FILTER (WHERE delivery_status = 'failed')::int AS failed,
        COUNT(*) FILTER (WHERE delivery_status = 'tapped_ok')::int AS "tappedOk"
      FROM delivery
      WHERE broadcast_id = ANY($1::uuid[])
      GROUP BY broadcast_id;
    `,
    [broadcastIds],
  );
  return new Map(rows.map((row) => [row.broadcastId, mapDeliveryCounts(row)]));
}

function applyBroadcastCursor<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  cursor: BroadcastCursor | null,
  alias: string,
): void {
  if (!cursor) {
    return;
  }
  query.andWhere(
    new Brackets((where) => {
      where
        // The cursor's text is compared as-is (not via a JavaScript Date) to keep microseconds.
        .where(`${alias}.createdAt < CAST(:cursorCreatedAt AS timestamptz)`, {
          cursorCreatedAt: cursor.createdAt,
        })
        .orWhere(
          `${alias}.createdAt = CAST(:cursorCreatedAt AS timestamptz) AND ${alias}.id < :cursorId`,
          { cursorCreatedAt: cursor.createdAt, cursorId: cursor.id },
        );
    }),
  );
}

export async function listBroadcasts(
  user: PolicyUser,
  { limit, cursor, ipAddress }: { limit: number; cursor?: string; ipAddress?: string | null },
  manager?: EntityManager,
): Promise<BroadcastPage> {
  const entityManager = await resolveManager(manager);
  const parsedCursor = cursor ? decodeCursor(cursor) : null;

  const execute = async (transactionManager: EntityManager): Promise<BroadcastPage> => {
    const query = transactionManager
      .getRepository(Broadcast)
      .createQueryBuilder("broadcast")
      .leftJoin("broadcast.senderPerson", "sender")
      .select([
        "broadcast.id AS id",
        "broadcast.broadcastStatus AS status",
        "broadcast.messageText AS \"messageText\"",
        "broadcast.audienceFilter AS \"audienceFilter\"",
        "broadcast.scheduledSendAt AS \"scheduledSendAt\"",
        "broadcast.createdAt AS \"createdAt\"",
        `${exactCreatedAtSql("broadcast")} AS "cursorCreatedAt"`,
        "sender.id AS \"senderId\"",
        "sender.fullName AS \"senderDisplayName\"",
      ]);

    if (!user.isAdmin) {
      query.andWhere("broadcast.senderPersonId = :senderPersonId", {
        senderPersonId: user.personId,
      });
    }

    applyBroadcastCursor(query, parsedCursor, "broadcast");

    const rows = await query
      .orderBy("broadcast.createdAt", "DESC")
      .addOrderBy("broadcast.id", "DESC")
      .limit(limit + 1)
      .getRawMany<{
        id: string;
        status: string;
        messageText: string;
        audienceFilter: Record<string, unknown>;
        scheduledSendAt: Date | null;
        createdAt: Date;
        cursorCreatedAt: string;
        senderId: string;
        senderDisplayName: string;
      }>();

    const hasNextPage = rows.length > limit;
    const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
    const ids = pageRows.map((row) => row.id);
    const [deliveryCounts, audienceSummaries] = await Promise.all([
      listDeliveryCounts(ids, transactionManager),
      resolveAudienceSummaries(pageRows.map((row) => row.audienceFilter), transactionManager),
    ]);

    if (pageRows.length > 0) {
      await transactionManager.getRepository(AuditLog).insert({
        actorPersonId: user.personId,
        actionType: "view_broadcasts",
        targetEntityType: null,
        targetEntityId: null,
        ipAddress: ipAddress ?? null,
      });
    }

    const lastRow = pageRows.at(-1);
    return {
      items: pageRows.map((row, index) => ({
        id: row.id,
        status: row.status,
        title: getBroadcastTitle(row.messageText),
        messageText: Array.from(row.messageText).slice(0, MAX_MESSAGE_TEXT).join(""),
        sender: { id: row.senderId, displayName: row.senderDisplayName },
        audienceSummary: audienceSummaries[index],
        deliveryCounts: deliveryCounts.get(row.id) ?? mapDeliveryCounts(),
        scheduledSendAt: row.scheduledSendAt,
        createdAt: row.createdAt,
      })),
      nextCursor:
        hasNextPage && lastRow
          ? encodeCursor({ createdAt: lastRow.cursorCreatedAt, id: lastRow.id })
          : null,
    };
  };

  if (entityManager.queryRunner?.isTransactionActive) return execute(entityManager);
  return entityManager.transaction(execute);
}

async function findAccessibleBroadcast(
  user: PolicyUser,
  broadcastId: string,
  entityManager: EntityManager,
): Promise<Broadcast | null> {
  const query = entityManager
    .getRepository(Broadcast)
    .createQueryBuilder("broadcast")
    .where("broadcast.id = :broadcastId", { broadcastId });

  if (!user.isAdmin) {
    query.andWhere("broadcast.senderPersonId = :senderPersonId", {
      senderPersonId: user.personId,
    });
  }

  return query.getOne();
}

export async function getBroadcastDetail(
  user: PolicyUser,
  broadcastId: string,
  ipAddress?: string | null,
  manager?: EntityManager,
): Promise<BroadcastDetail | null> {
  const entityManager = await resolveManager(manager);
  const execute = async (transactionManager: EntityManager): Promise<BroadcastDetail | null> => {
    const broadcast = await findAccessibleBroadcast(user, broadcastId, transactionManager);
    if (!broadcast) return null;

    const [senderRows, countRows, audienceSummaries] = await Promise.all([
      transactionManager.query<Array<{ id: string; displayName: string }>>(
        `SELECT id, full_name AS "displayName" FROM person WHERE id = $1::uuid;`,
        [broadcast.senderPersonId],
      ),
      listDeliveryCounts([broadcastId], transactionManager),
      resolveAudienceSummaries([broadcast.audienceFilter], transactionManager),
    ]);
    const sender = senderRows[0];
    if (!sender) throw new Error("Broadcast sender record is missing");
    await transactionManager.getRepository(AuditLog).insert({
      actorPersonId: user.personId,
      actionType: "view_broadcast",
      targetEntityType: "broadcast",
      targetEntityId: broadcastId,
      ipAddress: ipAddress ?? null,
    });

    return {
      id: broadcast.id,
      status: broadcast.broadcastStatus,
      title: getBroadcastTitle(broadcast.messageText),
      messageText: broadcast.messageText,
      sender,
      audienceSummary: audienceSummaries[0],
      deliveryCounts: countRows.get(broadcastId) ?? mapDeliveryCounts(),
      scheduledSendAt: broadcast.scheduledSendAt,
      createdAt: broadcast.createdAt,
    };
  };

  if (entityManager.queryRunner?.isTransactionActive) return execute(entityManager);
  return entityManager.transaction(execute);
}

export async function listBroadcastDeliveries(
  user: PolicyUser,
  broadcastId: string,
  {
    limit,
    cursor,
    ipAddress,
  }: { limit: number; cursor?: string; ipAddress?: string | null },
  manager?: EntityManager,
): Promise<DeliveryPage | null> {
  const entityManager = await resolveManager(manager);
  const execute = async (transactionManager: EntityManager): Promise<DeliveryPage | null> => {
    const broadcast = await findAccessibleBroadcast(user, broadcastId, transactionManager);
    if (!broadcast) {
      return null;
    }

    const parsedCursor = cursor ? decodeCursor(cursor) : null;
    const query = transactionManager
      .getRepository(Delivery)
      .createQueryBuilder("delivery")
      .innerJoin("delivery.person", "person")
      .select("delivery.id", "id")
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
      .addSelect("delivery.deliveryChannel", "channel")
      .addSelect("delivery.deliveryStatus", "status")
      .addSelect("delivery.sentAt", "sentAt")
      .addSelect("delivery.deliveredAt", "deliveredAt")
      .addSelect("delivery.tappedOkAt", "tappedOkAt")
      .addSelect("delivery.failedAt", "failedAt")
      .addSelect("delivery.createdAt", "createdAt")
      .addSelect(exactCreatedAtSql("delivery"), "cursorCreatedAt")
      .where("delivery.broadcastId = :broadcastId", { broadcastId });

    applyBroadcastCursor(query, parsedCursor, "delivery");

    const rows = await query
      .orderBy("delivery.createdAt", "DESC")
      .addOrderBy("delivery.id", "DESC")
      .limit(limit + 1)
      .getRawMany<{
        id: string;
        personId: string;
        fullName: string;
        phoneNumber: string | null;
        channel: string;
        status: string;
        sentAt: Date | null;
        deliveredAt: Date | null;
        tappedOkAt: Date | null;
        failedAt: Date | null;
        createdAt: Date;
        cursorCreatedAt: string;
      }>();

    const hasNextPage = rows.length > limit;
    const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
    const lastRow = pageRows.at(-1);
    const recipients = await resolveDeliveryRecipients(
      [...new Set(pageRows.map((row) => row.personId))],
      transactionManager,
    );

    await transactionManager.getRepository(AuditLog).insert({
      actorPersonId: user.personId,
      actionType: "view_broadcast_deliveries",
      targetEntityType: "broadcast",
      targetEntityId: broadcastId,
      ipAddress: ipAddress ?? null,
    });

    return {
      items: pageRows.map((row) => ({
        id: row.id,
        personId: row.personId,
        fullName: row.fullName,
        maskedPhone: maskPhoneNumber(row.phoneNumber),
        channel: row.channel,
        status: row.status,
        sentAt: row.sentAt,
        deliveredAt: row.deliveredAt,
        tappedOkAt: row.tappedOkAt,
        failedAt: row.failedAt,
        createdAt: row.createdAt,
        recipient: recipients.get(row.personId) ?? EMPTY_RECIPIENT,
      })),
      nextCursor:
        hasNextPage && lastRow
          ? encodeCursor({ createdAt: lastRow.cursorCreatedAt, id: lastRow.id })
          : null,
    };
  };

  if (entityManager.queryRunner?.isTransactionActive) {
    return execute(entityManager);
  }
  return entityManager.transaction(execute);
}
