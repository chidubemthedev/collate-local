import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient, ApiClientError } from "./client";

describe("apiClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("unboxes success envelopes correctly", async () => {
    const mockData = { ok: true, count: 42 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "success",
        data: mockData,
        meta: { nextCursor: null },
      }),
    } as Response);

    const result = await apiClient.get<typeof mockData>("/api/test");
    expect(result.data).toEqual(mockData);
    expect(result.meta?.nextCursor).toBeNull();
  });

  it("formats query parameters into URL correctly", async () => {
    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ status: "success", data: {} }),
      } as Response);
    });

    await apiClient.get("/api/coverage/summary", {
      stateId: 1,
      lgaId: 2,
      emptyVal: null,
      undefinedVal: undefined,
    });

    expect(capturedUrl).toBe("/api/coverage/summary?stateId=1&lgaId=2");
  });

  it("throws ApiClientError with code and fields on error envelopes", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        status: "error",
        error: {
          code: "validation_failed",
          message: "Invalid input provided",
          fields: { email: "Invalid format" },
        },
      }),
    } as Response);

    await expect(apiClient.post("/api/auth/otp/request", { email: "bad" })).rejects.toThrowError(
      ApiClientError
    );

    try {
      await apiClient.post("/api/auth/otp/request", { email: "bad" });
    } catch (err) {
      const error = err as ApiClientError;
      expect(error.code).toBe("validation_failed");
      expect(error.message).toBe("Invalid input provided");
      expect(error.status).toBe(400);
      expect(error.fields?.email).toBe("Invalid format");
    }
  });

  it("sends credentials: 'include' by default", async () => {
    let capturedOptions: RequestInit | undefined;
    global.fetch = vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
      capturedOptions = options;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ status: "success", data: {} }),
      } as Response);
    });

    await apiClient.get("/api/auth/session");
    expect(capturedOptions?.credentials).toBe("include");
  });
});
