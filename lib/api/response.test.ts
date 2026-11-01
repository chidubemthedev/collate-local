import { describe, expect, it } from "vitest";
import { failure, internalError, success } from "./response";

describe("API response envelopes", () => {
  it("wraps successful data and includes metadata only when provided", async () => {
    const listResponse = success([{ id: 1 }], { nextCursor: "cursor", limit: 50 });
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual({
      status: "success",
      data: [{ id: 1 }],
      meta: { nextCursor: "cursor", limit: 50 },
    });

    const emptyResponse = success(null);
    await expect(emptyResponse.json()).resolves.toEqual({
      status: "success",
      data: null,
    });
  });

  it("wraps failures with stable status codes and validation fields only", async () => {
    const validationResponse = failure(
      "validation_failed",
      "Invalid request parameters",
      { limit: "must_be_at_most_100" },
    );
    expect(validationResponse.status).toBe(400);
    await expect(validationResponse.json()).resolves.toEqual({
      status: "error",
      error: {
        code: "validation_failed",
        message: "Invalid request parameters",
        fields: { limit: "must_be_at_most_100" },
      },
    });

    const notFoundResponse = failure("not_found", "Resource not found", {
      id: "ignored",
    });
    expect(notFoundResponse.status).toBe(404);
    await expect(notFoundResponse.json()).resolves.toEqual({
      status: "error",
      error: { code: "not_found", message: "Resource not found" },
    });
  });

  it("sets Retry-After on rate limits and uses a safe internal error", async () => {
    const rateLimitResponse = failure("too_many_requests", "Too many requests");
    expect(rateLimitResponse.status).toBe(429);
    expect(rateLimitResponse.headers.get("Retry-After")).toBe("60");

    const response = internalError();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      error: {
        code: "internal_error",
        message: "An unexpected error occurred",
      },
    });
  });
});
