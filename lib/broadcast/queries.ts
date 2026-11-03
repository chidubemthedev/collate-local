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
}

export interface DeliveryPage {
  items: DeliveryListItem[];
  nextCursor: string | null;
}

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
        .where(`${alias}.createdAt < :cursorCreatedAt`, {
          cursorCreatedAt: new Date(cursor.createdAt),
        })
        .orWhere(
          `${alias}.createdAt = :cursorCreatedAt AND ${alias}.id < :cursorId`,
          { cursorCreatedAt: new Date(cursor.createdAt), cursorId: cursor.id },
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
          ? encodeCursor({
              createdAt: new Date(lastRow.createdAt).toISOString(),
              id: lastRow.id,
            })
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
      }>();

    const hasNextPage = rows.length > limit;
    const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
    const lastRow = pageRows.at(-1);

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
      })),
      nextCursor:
        hasNextPage && lastRow
          ? encodeCursor({
              createdAt: new Date(lastRow.createdAt).toISOString(),
              id: lastRow.id,
            })
          : null,
    };
  };

  if (entityManager.queryRunner?.isTransactionActive) {
    return execute(entityManager);
  }
  return entityManager.transaction(execute);
}
