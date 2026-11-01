import { UnauthorizedError } from "@/lib/auth/errors";
import { failure } from "@/lib/api/response";
import { ForbiddenError, InvalidFilterError } from "./errors";

export function policyErrorResponse(error: unknown): Response | null {
  if (error instanceof UnauthorizedError) {
    return failure("unauthorized", "Authentication is required");
  }
  if (error instanceof ForbiddenError) {
    return failure("forbidden", "Access is not permitted");
  }
  if (error instanceof InvalidFilterError) {
    return failure("invalid_filter", "The requested filter is invalid");
  }
  return null;
}
