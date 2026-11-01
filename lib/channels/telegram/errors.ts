import { GrammyError, HttpError } from "grammy";

export class TelegramRateLimitedError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Telegram rate limit exceeded.");
    this.name = "TelegramRateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class TelegramBlockedError extends Error {
  readonly statusCode = 403;

  constructor() {
    super("Telegram rejected the request because the bot is blocked.");
    this.name = "TelegramBlockedError";
  }
}

export class TelegramChatNotFoundError extends Error {
  constructor() {
    super("Telegram chat was not found.");
    this.name = "TelegramChatNotFoundError";
  }
}

export class TelegramPermanentError extends Error {
  constructor() {
    super("Telegram rejected the request.");
    this.name = "TelegramPermanentError";
  }
}

export class TelegramTransientError extends Error {
  constructor() {
    super("Telegram request failed temporarily.");
    this.name = "TelegramTransientError";
  }
}

export function mapTelegramError(error: unknown): Error {
  if (
    error instanceof TelegramRateLimitedError ||
    error instanceof TelegramBlockedError ||
    error instanceof TelegramChatNotFoundError ||
    error instanceof TelegramPermanentError ||
    error instanceof TelegramTransientError
  ) {
    return error;
  }

  if (error instanceof GrammyError) {
    if (error.error_code === 429) {
      return new TelegramRateLimitedError(error.parameters.retry_after ?? 0);
    }

    if (error.error_code === 403) {
      return new TelegramBlockedError();
    }

    if (error.error_code === 400 && /chat not found/i.test(error.description)) {
      return new TelegramChatNotFoundError();
    }

    if (error.error_code >= 400 && error.error_code < 500) {
      return new TelegramPermanentError();
    }
  }

  if (error instanceof HttpError) {
    return new TelegramTransientError();
  }

  if (error instanceof GrammyError && error.error_code >= 500) {
    return new TelegramTransientError();
  }

  return new TelegramTransientError();
}
