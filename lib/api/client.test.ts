import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function reply(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

const SIGNED_OUT = { status: "error", error: { code: "unauthorized", message: "Authentication is required" } };

describe("apiFetch and an expired session", () => {
  let replace: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // The client remembers it is already redirecting, so load a fresh copy for each test.
    vi.resetModules();
    replace = vi.fn();
    vi.stubGlobal("window", { location: { pathname: "/agents", replace } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the person to the sign-in page on 401 unauthorized, and still rejects", async () => {
    vi.stubGlobal("fetch", reply(401, SIGNED_OUT));
    const { apiClient, ApiClientError } = await import("./client");
    await expect(apiClient.get("/api/agents")).rejects.toBeInstanceOf(ApiClientError);
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("redirects once even when several requests fail together", async () => {
    vi.stubGlobal("fetch", reply(401, SIGNED_OUT));
    const { apiClient } = await import("./client");
    await Promise.allSettled([apiClient.get("/api/agents"), apiClient.get("/api/coverage/summary")]);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("stays on the sign-in page itself", async () => {
    vi.stubGlobal("window", { location: { pathname: "/login", replace } });
    vi.stubGlobal("fetch", reply(401, SIGNED_OUT));
    const { apiClient } = await import("./client");
    await expect(apiClient.get("/api/auth/permissions")).rejects.toThrow();
    expect(replace).not.toHaveBeenCalled();
  });

  it("stays on a sign-in link", async () => {
    vi.stubGlobal("window", { location: { pathname: "/login/link", replace } });
    vi.stubGlobal("fetch", reply(401, SIGNED_OUT));
    const { apiClient } = await import("./client");
    await expect(apiClient.get("/api/auth/permissions")).rejects.toThrow();
    expect(replace).not.toHaveBeenCalled();
  });

  it("stays on an invite link", async () => {
    vi.stubGlobal("window", { location: { pathname: "/invite/abc", replace } });
    vi.stubGlobal("fetch", reply(401, SIGNED_OUT));
    const { apiClient } = await import("./client");
    await expect(apiClient.get("/api/auth/permissions")).rejects.toThrow();
    expect(replace).not.toHaveBeenCalled();
  });

  it("leaves a wrong sign-in code and other errors to the page", async () => {
    vi.stubGlobal(
      "fetch",
      reply(401, { status: "error", error: { code: "invalid_or_expired_code", message: "Invalid code" } }),
    );
    const { apiClient } = await import("./client");
    await expect(apiClient.post("/api/auth/otp/verify", {})).rejects.toThrow("Invalid code");

    vi.stubGlobal("fetch", reply(403, { status: "error", error: { code: "forbidden", message: "No" } }));
    await expect(apiClient.get("/api/settings/admins")).rejects.toThrow("No");
    expect(replace).not.toHaveBeenCalled();
  });
});
