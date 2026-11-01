export const ERROR_CODES = [
  "validation_failed",
  "invalid_filter",
  "unauthorized",
  "invalid_or_expired_code",
  "forbidden",
  "invalid_origin",
  "not_found",
  "conflict",
  "too_many_requests",
  "internal_error",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  validation_failed: 400,
  invalid_filter: 400,
  unauthorized: 401,
  invalid_or_expired_code: 400,
  forbidden: 403,
  invalid_origin: 403,
  not_found: 404,
  conflict: 409,
  too_many_requests: 429,
  internal_error: 500,
};
