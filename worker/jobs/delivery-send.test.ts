import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityManager } from "typeorm";
import { Broadcast, BroadcastStatus } from "../../lib/db/entities/broadcast.entity";
import { Delivery, DeliveryStatus } from "../../lib/db/entities/delivery.entity";
import { PhoneNumber } from "../../lib/db/entities/phone-number.entity";
import { TelegramBlockedError } from "../../lib/channels/telegram/errors";

const mocks = vi.hoisted(() => ({
  hasAcceptedConsent: vi.fn(),
  hasDeclinedConsent: vi.fn(),
  telegramSend: vi.fn(),
  smsSend: vi.fn(),
}));

vi.mock("../../lib/channels/telegram/link/link", () => ({
  hasAcceptedConsent: mocks.hasAcceptedConsent,
  hasDeclinedConsent: mocks.hasDeclinedConsent,
}));

import { sendDelivery } from "./delivery-send";

interface ManagerOptions {
  deliveryStatus?: DeliveryStatus;
  telegramChatId?: string | null;
  hasConfirmedPhone?: boolean;
}

function makeManager(options: ManagerOptions = {}) {
  const deliveryId = "11111111-1111-4111-8111-111111111111";
  const broadcastId = "22222222-2222-4222-8222-222222222222";
  const delivery = {
    id: deliveryId,
    broadcastId,
    personId: "33333333-3333-4333-8333-333333333333",
    deliveryStatus: options.deliveryStatus ?? DeliveryStatus.PENDING,
  };
  const broadcast = {
    id: broadcastId,
    broadcastStatus: BroadcastStatus.SENDING,
    messageText: "Test message",
  };
  const phone = {
    e164Number: ["+", "1", "202", "555", "0101"].join(""),
    telegramChatId: options.telegramChatId === undefined
      ? "test-chat-id"
      : options.telegramChatId,
    isConfirmed: options.hasConfirmedPhone ?? true,
  };
  const queries: string[] = [];
  const manager = {
    getRepository(entity: typeof Delivery | typeof Broadcast | typeof PhoneNumber) {
      if (entity === Delivery) {
        return { findOne: vi.fn(async () => delivery) };
      }
      if (entity === Broadcast) {
        return { findOne: vi.fn(async () => broadcast) };
      }

      return {
        createQueryBuilder() {
          let telegramOnly = false;
          type PhoneQueryBuilder = {
            where: (condition: string) => PhoneQueryBuilder;
            andWhere: (condition: string) => PhoneQueryBuilder;
            orderBy: (column: string, direction: string) => PhoneQueryBuilder;
            addOrderBy: (column: string, direction: string) => PhoneQueryBuilder;
            getOne: () => Promise<typeof phone | null>;
          };
          const builder: PhoneQueryBuilder = {
            where: vi.fn((condition: string) => {
              telegramOnly ||= condition.includes("telegramChatId IS NOT NULL");
              return builder;
            }),
            andWhere: vi.fn((condition: string) => {
              telegramOnly ||= condition.includes("telegramChatId IS NOT NULL");
              return builder;
            }),
            orderBy: vi.fn().mockReturnThis(),
            addOrderBy: vi.fn().mockReturnThis(),
            getOne: vi.fn(async () => {
              if (!phone.isConfirmed) {
                return null;
              }
              return telegramOnly && !phone.telegramChatId ? null : phone;
            }),
          };
          return builder;
        },
      };
    },
    async query(sql: string) {
      queries.push(sql);
      return [];
    },
  };

  return {
    manager: manager as unknown as EntityManager,
    deliveryId,
    queries,
  };
}

function dependencies(manager: EntityManager) {
  return {
    manager,
    telegram: { send: mocks.telegramSend },
    sms: { send: mocks.smsSend },
    limiter: {
      acquire: vi.fn(async () => undefined),
      pause: vi.fn(),
    },
  };
}

describe("sendDelivery consent checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasAcceptedConsent.mockResolvedValue(true);
    mocks.hasDeclinedConsent.mockResolvedValue(false);
    mocks.telegramSend.mockResolvedValue(undefined);
    mocks.smsSend.mockResolvedValue(undefined);
  });

  it("blocks Telegram and SMS sends after a decline", async () => {
    mocks.hasDeclinedConsent.mockResolvedValue(true);
    const telegramManager = makeManager();
    await sendDelivery(telegramManager.deliveryId, dependencies(telegramManager.manager));

    expect(mocks.telegramSend).not.toHaveBeenCalled();
    expect(mocks.smsSend).not.toHaveBeenCalled();
    expect(telegramManager.queries.some((sql) =>
      sql.includes("SET delivery_status = 'failed'") && sql.includes("failed_at = NOW()"),
    )).toBe(true);
    expect(telegramManager.queries.some((sql) => sql.includes("UPDATE broadcast"))).toBe(true);

    mocks.hasAcceptedConsent.mockResolvedValue(false);
    const smsManager = makeManager({ telegramChatId: null });
    await sendDelivery(smsManager.deliveryId, dependencies(smsManager.manager));

    expect(mocks.telegramSend).not.toHaveBeenCalled();
    expect(mocks.smsSend).not.toHaveBeenCalled();
    expect(smsManager.queries.some((sql) =>
      sql.includes("SET delivery_status = 'failed'") && sql.includes("failed_at = NOW()"),
    )).toBe(true);
    expect(smsManager.queries.some((sql) => sql.includes("UPDATE broadcast"))).toBe(true);
  });

  it("sends through Telegram only when consent is accepted", async () => {
    const { manager, deliveryId } = makeManager();
    await sendDelivery(deliveryId, dependencies(manager));

    expect(mocks.telegramSend).toHaveBeenCalledOnce();
    expect(mocks.smsSend).not.toHaveBeenCalled();
    expect(mocks.hasDeclinedConsent).toHaveBeenCalled();
  });

  it("keeps the no-consent SMS fallback", async () => {
    mocks.hasAcceptedConsent.mockResolvedValue(false);
    const { manager, deliveryId } = makeManager();
    await sendDelivery(deliveryId, dependencies(manager));

    expect(mocks.telegramSend).not.toHaveBeenCalled();
    expect(mocks.smsSend).toHaveBeenCalledOnce();
  });

  it("falls back to SMS after a Telegram failure when consent has not been declined", async () => {
    mocks.telegramSend.mockRejectedValue(new TelegramBlockedError());
    const { manager, deliveryId } = makeManager();
    await sendDelivery(deliveryId, dependencies(manager));

    expect(mocks.telegramSend).toHaveBeenCalledOnce();
    expect(mocks.smsSend).toHaveBeenCalledOnce();
    expect(mocks.hasDeclinedConsent).toHaveBeenCalledTimes(2);
  });

  it("skips terminal deliveries without sending or rechecking consent", async () => {
    const { manager, deliveryId, queries } = makeManager({
      deliveryStatus: DeliveryStatus.DELIVERED,
    });
    await sendDelivery(deliveryId, dependencies(manager));

    expect(mocks.telegramSend).not.toHaveBeenCalled();
    expect(mocks.smsSend).not.toHaveBeenCalled();
    expect(mocks.hasAcceptedConsent).not.toHaveBeenCalled();
    expect(mocks.hasDeclinedConsent).not.toHaveBeenCalled();
    expect(queries).toEqual([]);
  });
});
