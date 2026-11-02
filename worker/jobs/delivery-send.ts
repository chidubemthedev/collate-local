import type { EntityManager } from "typeorm";
import type { JobWithMetadata } from "pg-boss";
import { Broadcast, BroadcastStatus } from "../../lib/db/entities/broadcast.entity";
import {
  Delivery,
  DeliveryStatus,
} from "../../lib/db/entities/delivery.entity";
import { PhoneNumber } from "../../lib/db/entities/phone-number.entity";
import { getSmsChannel } from "../../lib/channels/sms";
import { SmsNotConfiguredError } from "../../lib/channels/sms/channel";
import type { SmsChannel } from "../../lib/channels/sms/channel";
import { TelegramChannel } from "../../lib/channels/telegram/adapter";
import {
  TelegramRateLimitedError,
  TelegramTransientError,
} from "../../lib/channels/telegram/errors";
import type { ChannelAdapter } from "../../lib/channels/types";
import {
  getTelegramLimiter,
  type TelegramLimiter,
} from "../../lib/channels/telegram/limiter";
import {
  hasAcceptedConsent,
  hasDeclinedConsent,
} from "../../lib/channels/telegram/link/link";
import { getWorkerDataSource } from "../lib/database";
import {
  isTerminalDeliveryStatus,
  shouldFallbackAfterTransient,
  shouldFallbackImmediately,
} from "./delivery-decisions";

export interface DeliverySendJobData {
  deliveryId: string;
}

export interface DeliverySendDeps {
  manager?: EntityManager;
  telegram?: Pick<ChannelAdapter, "send">;
  sms?: SmsChannel;
  limiter?: Pick<TelegramLimiter, "acquire" | "pause">;
  attempt?: { retryCount: number; retryLimit: number };
}

const DEFAULT_RETRY_LIMIT = 5;

export async function sendDelivery(
  deliveryId: string,
  deps: DeliverySendDeps = {},
): Promise<void> {
  const manager = deps.manager ?? (await getWorkerDataSource()).manager;

  const delivery = await manager.getRepository(Delivery).findOne({
    where: { id: deliveryId },
  });
  if (!delivery || isTerminalDeliveryStatus(delivery.deliveryStatus)) {
    return;
  }

  const broadcast = await manager.getRepository(Broadcast).findOne({
    where: { id: delivery.broadcastId },
  });
  if (!broadcast || broadcast.broadcastStatus === BroadcastStatus.CANCELLED) {
    return;
  }

  await manager.query(
    `
      UPDATE delivery
      SET delivery_status = 'sent', sent_at = COALESCE(sent_at, NOW())
      WHERE id = $1::uuid AND delivery_status = 'pending';
    `,
    [delivery.id],
  );

  const telegramPhone = await findTelegramPhone(manager, delivery.personId);
  const consentAccepted = await hasAcceptedConsent(delivery.personId, manager);

  if (!telegramPhone || !consentAccepted) {
    await fallbackToSms(manager, delivery, broadcast, deps);
    return;
  }

  const limiter = deps.limiter ?? getTelegramLimiter();
  const telegram = deps.telegram ?? new TelegramChannel();
  const attempt = deps.attempt ?? {
    retryCount: 0,
    retryLimit: DEFAULT_RETRY_LIMIT,
  };

  await limiter.acquire();
  try {
    if (await hasDeclinedConsent(delivery.personId, manager)) {
      await markFailed(manager, delivery.id);
      await completeBroadcastIfFinished(manager, broadcast.id);
      return;
    }

    if (!(await hasAcceptedConsent(delivery.personId, manager))) {
      await fallbackToSms(manager, delivery, broadcast, deps);
      return;
    }

    await telegram.send({
      chatId: telegramPhone.telegramChatId as string,
      text: broadcast.messageText,
      okButtonDeliveryId: delivery.id,
    });
    await markDelivered(manager, delivery.id, DeliveryStatus.DELIVERED);
    await completeBroadcastIfFinished(manager, broadcast.id);
  } catch (error) {
    if (error instanceof TelegramRateLimitedError) {
      limiter.pause(error.retryAfterSeconds);
      throw error;
    }

    if (error instanceof TelegramTransientError) {
      if (shouldFallbackAfterTransient(attempt.retryCount, attempt.retryLimit)) {
        await fallbackToSms(manager, delivery, broadcast, deps);
        return;
      }
      throw error;
    }

    if (shouldFallbackImmediately(error)) {
      await fallbackToSms(manager, delivery, broadcast, deps);
      return;
    }

    throw error;
  }
}

async function findTelegramPhone(
  manager: EntityManager,
  personId: string,
): Promise<PhoneNumber | null> {
  return manager
    .getRepository(PhoneNumber)
    .createQueryBuilder("phone")
    .where("phone.personId = :personId", { personId })
    .andWhere("phone.isConfirmed = TRUE")
    .andWhere("phone.telegramChatId IS NOT NULL")
    .orderBy("phone.createdAt", "ASC")
    .addOrderBy("phone.id", "ASC")
    .getOne();
}

async function findConfirmedPhone(
  manager: EntityManager,
  personId: string,
): Promise<PhoneNumber | null> {
  return manager
    .getRepository(PhoneNumber)
    .createQueryBuilder("phone")
    .where("phone.personId = :personId", { personId })
    .andWhere("phone.isConfirmed = TRUE")
    .orderBy("phone.createdAt", "ASC")
    .addOrderBy("phone.id", "ASC")
    .getOne();
}

async function markDelivered(
  manager: EntityManager,
  deliveryId: string,
  status: DeliveryStatus,
): Promise<void> {
  await manager.query(
    `
      UPDATE delivery
      SET delivery_status = $2::delivery_status,
          delivered_at = NOW()
      WHERE id = $1::uuid;
    `,
    [deliveryId, status],
  );
}

async function markFailed(
  manager: EntityManager,
  deliveryId: string,
): Promise<void> {
  await manager.query(
    `
      UPDATE delivery
      SET delivery_status = 'failed',
          failed_at = NOW()
      WHERE id = $1::uuid;
    `,
    [deliveryId],
  );
}

async function fallbackToSms(
  manager: EntityManager,
  delivery: Delivery,
  broadcast: Broadcast,
  deps: DeliverySendDeps,
): Promise<void> {
  const phone = await findConfirmedPhone(manager, delivery.personId);
  if (!phone) {
    await markFailed(manager, delivery.id);
    await completeBroadcastIfFinished(manager, broadcast.id);
    return;
  }

  await manager.query(
    `UPDATE delivery SET delivery_channel = 'sms' WHERE id = $1::uuid;`,
    [delivery.id],
  );

  if (await hasDeclinedConsent(delivery.personId, manager)) {
    await markFailed(manager, delivery.id);
    await completeBroadcastIfFinished(manager, broadcast.id);
    return;
  }

  try {
    const sms = deps.sms ?? getSmsChannel();
    // TODO(decision): SMS to a person with no consent row; needs a product and legal decision (NDPA s.30)
    await sms.send({ e164: phone.e164Number, text: broadcast.messageText });
    await markDelivered(manager, delivery.id, DeliveryStatus.DELIVERED_BY_SMS);
  } catch (error) {
    if (!(error instanceof SmsNotConfiguredError) && !(error instanceof Error)) {
      throw error;
    }
    await markFailed(manager, delivery.id);
  }

  await completeBroadcastIfFinished(manager, broadcast.id);
}

async function completeBroadcastIfFinished(
  manager: EntityManager,
  broadcastId: string,
): Promise<void> {
  await manager.query(
    `
      UPDATE broadcast
      SET broadcast_status = CASE
        WHEN EXISTS (
          SELECT 1 FROM delivery
          WHERE broadcast_id = $1::uuid AND delivery_status <> 'failed'
        ) THEN 'completed'::broadcast_status
        ELSE 'failed'::broadcast_status
      END
      WHERE id = $1::uuid
        AND broadcast_status = 'sending'
        AND NOT EXISTS (
          SELECT 1 FROM delivery
          WHERE broadcast_id = $1::uuid
            AND delivery_status IN ('pending', 'sent')
        );
    `,
    [broadcastId],
  );
}

export async function handleDeliverySend(
  jobs: JobWithMetadata<DeliverySendJobData>[],
): Promise<void> {
  for (const job of jobs) {
    await sendDelivery(job.data.deliveryId, {
      attempt: {
        retryCount: job.retryCount,
        retryLimit: job.retryLimit,
      },
    });
  }
}
