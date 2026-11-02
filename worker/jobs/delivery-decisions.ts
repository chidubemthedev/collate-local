import { DeliveryStatus } from "../../lib/db/entities/delivery.entity";
import {
  TelegramBlockedError,
  TelegramChatNotFoundError,
  TelegramPermanentError,
} from "../../lib/channels/telegram/errors";

const TERMINAL_STATUSES: ReadonlySet<DeliveryStatus> = new Set([
  DeliveryStatus.DELIVERED,
  DeliveryStatus.DELIVERED_BY_SMS,
  DeliveryStatus.TAPPED_OK,
  DeliveryStatus.FAILED,
]);

export function isTerminalDeliveryStatus(status: DeliveryStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function shouldFallbackAfterTransient(
  retryCount: number,
  retryLimit: number,
): boolean {
  return retryCount >= retryLimit;
}

export function shouldFallbackImmediately(error: unknown): boolean {
  return (
    error instanceof TelegramBlockedError ||
    error instanceof TelegramChatNotFoundError ||
    error instanceof TelegramPermanentError
  );
}
