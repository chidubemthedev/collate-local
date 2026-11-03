import { ERROR_HTTP_STATUS } from "./error-codes";
import type { ErrorCode } from "./error-codes";

export interface SuccessMeta {
  nextCursor?: string | null;
  limit?: number;
  total?: number;
}

export function success<T>(
  data: T | null,
  meta?: SuccessMeta,
  status = 200,
): Response {
  return Response.json({
    status: "success",
    data,
    ...(meta ? { meta } : {}),
  }, { status });
}

export function failure(
  code: ErrorCode,
  message: string,
  fields?: Record<string, string>,
): Response {
  const headers = code === "too_many_requests"
    ? { "Retry-After": "60" }
    : undefined;

  return Response.json({
    status: "error",
    error: {
      code,
      message,
      ...(code === "validation_failed" && fields ? { fields } : {}),
    },
  }, {
    status: ERROR_HTTP_STATUS[code],
    headers,
  });
}

export function internalError(): Response {
  return failure("internal_error", "An unexpected error occurred");
}
