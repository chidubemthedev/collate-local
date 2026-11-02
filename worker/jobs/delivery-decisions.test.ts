import { describe, expect, it } from "vitest";
import { DeliveryStatus } from "../../lib/db/entities/delivery.entity";
import {
  TelegramBlockedError,
  TelegramChatNotFoundError,
  TelegramPermanentError,
  TelegramTransientError,
} from "../../lib/channels/telegram/errors";
import {
  isTerminalDeliveryStatus,
  shouldFallbackAfterTransient,
  shouldFallbackImmediately,
} from "./delivery-decisions";

describe("delivery state decisions", () => {
  it("skips every terminal status", () => {
    for (const status of [
      DeliveryStatus.DELIVERED,
      DeliveryStatus.DELIVERED_BY_SMS,
      DeliveryStatus.TAPPED_OK,
      DeliveryStatus.FAILED,
    ]) {
      expect(isTerminalDeliveryStatus(status)).toBe(true);
    }
    for (const status of [DeliveryStatus.PENDING, DeliveryStatus.SENT]) {
      expect(isTerminalDeliveryStatus(status)).toBe(false);
    }
  });

  it("falls back only on the final transient attempt", () => {
    expect(shouldFallbackAfterTransient(0, 5)).toBe(false);
    expect(shouldFallbackAfterTransient(4, 5)).toBe(false);
    expect(shouldFallbackAfterTransient(5, 5)).toBe(true);
  });

  it("falls back immediately for permanent Telegram failures", () => {
    expect(shouldFallbackImmediately(new TelegramBlockedError())).toBe(true);
    expect(shouldFallbackImmediately(new TelegramChatNotFoundError())).toBe(true);
    expect(shouldFallbackImmediately(new TelegramPermanentError())).toBe(true);
    expect(shouldFallbackImmediately(new TelegramTransientError())).toBe(false);
    expect(shouldFallbackImmediately(new Error("unknown"))).toBe(false);
  });
});
