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
  messageText: string;
  scheduledSendAt: Date | null;
  createdAt: Date;
}

export interface BroadcastPage {
  items: BroadcastListItem[];
  nextCursor: string | null;
}

export interface BroadcastDetail {
  id: string;
  status: string;
  scheduledSendAt: Date | null;
  createdAt: Date;
  counts: Record<string, number>;
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
  { limit, cursor }: { limit: number; cursor?: string },
  manager?: EntityManager,
): Promise<BroadcastPage> {
  const entityManager = await resolveManager(manager);
  const parsedCursor = cursor ? decodeCursor(cursor) : null;

  const query = entityManager
    .getRepository(Broadcast)
    .createQueryBuilder("broadcast")
    .select([
      "broadcast.id AS id",
      "broadcast.broadcastStatus AS status",
      "broadcast.messageText AS \"messageText\"",
      "broadcast.scheduledSendAt AS \"scheduledSendAt\"",
      "broadcast.createdAt AS \"createdAt\"",
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
      scheduledSendAt: Date | null;
      createdAt: Date;
    }>();

  const hasNextPage = rows.length > limit;
  const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
  const lastRow = pageRows.at(-1);

  return {
    items: pageRows.map((row) => ({
      id: row.id,
      status: row.status,
      messageText: row.messageText.slice(0, MAX_MESSAGE_TEXT),
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
  manager?: EntityManager,
): Promise<BroadcastDetail | null> {
  const entityManager = await resolveManager(manager);
  const broadcast = await findAccessibleBroadcast(user, broadcastId, entityManager);
  if (!broadcast) {
    return null;
  }

  const counts = (await entityManager.query(
    `
      SELECT delivery_status, COUNT(*)::int AS count
      FROM delivery
      WHERE broadcast_id = $1::uuid
      GROUP BY delivery_status;
    `,
    [broadcastId],
  )) as Array<{ delivery_status: string; count: number | string }>;

  return {
    id: broadcast.id,
    status: broadcast.broadcastStatus,
    scheduledSendAt: broadcast.scheduledSendAt,
    createdAt: broadcast.createdAt,
    counts: {
      pending: 0,
      sent: 0,
      delivered: 0,
      delivered_by_sms: 0,
      failed: 0,
      tapped_ok: 0,
      ...Object.fromEntries(
        counts.map((row) => [row.delivery_status, Number(row.count)]),
      ),
    },
  };
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
