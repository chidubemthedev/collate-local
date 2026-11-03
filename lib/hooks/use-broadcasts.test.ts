import { describe, it, expect, vi, beforeEach } from "vitest";
import { BROADCAST_KEYS } from "./use-broadcasts";
import { apiClient } from "@/lib/api/client";
import type {
  BroadcastDetail,
  BroadcastListItem,
  DeliveryListItem,
} from "@/types/api";

describe("use-broadcasts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("BROADCAST_KEYS", () => {
    it("generates correct query key hierarchy", () => {
      expect(BROADCAST_KEYS.all).toEqual(["broadcasts"]);
      expect(BROADCAST_KEYS.lists()).toEqual(["broadcasts", "list"]);
      expect(BROADCAST_KEYS.list({ limit: 10 })).toEqual([
        "broadcasts",
        "list",
        { limit: 10 },
      ]);
      expect(BROADCAST_KEYS.details()).toEqual(["broadcasts", "detail"]);
      expect(BROADCAST_KEYS.detail("test-uuid")).toEqual([
        "broadcasts",
        "detail",
        "test-uuid",
      ]);
      expect(BROADCAST_KEYS.deliveries("test-uuid", { limit: 25 })).toEqual([
        "broadcasts",
        "detail",
        "test-uuid",
        "deliveries",
        { limit: 25 },
      ]);
      expect(
        BROADCAST_KEYS.preview({ stateId: 1, agentKind: "official" }),
      ).toEqual([
        "broadcasts",
        "preview",
        { stateId: 1, agentKind: "official" },
      ]);
    });
  });

  describe("api calls", () => {
    it("fetches broadcast list via apiClient", async () => {
      const getSpy = vi.spyOn(apiClient, "get").mockResolvedValue({
        data: [
          {
            id: "b-1",
            status: "sending",
            messageText: "Test broadcast",
            scheduledSendAt: null,
            createdAt: "2026-11-03T00:00:00Z",
          },
        ],
        meta: { nextCursor: "cursor-1" },
      });

      const res = await apiClient.get<BroadcastListItem[]>("/api/broadcasts", { limit: 10 });
      expect(getSpy).toHaveBeenCalledWith("/api/broadcasts", { limit: 10 });
      expect(res.data).toHaveLength(1);
      expect(res.meta?.nextCursor).toBe("cursor-1");
    });

    it("fetches broadcast detail via apiClient", async () => {
      const getSpy = vi.spyOn(apiClient, "get").mockResolvedValue({
        data: {
          id: "b-1",
          status: "completed",
          scheduledSendAt: null,
          createdAt: "2026-11-03T00:00:00Z",
          counts: { pending: 0, sent: 10, delivered: 10, failed: 0, tapped_ok: 5 },
        },
      });

      const res = await apiClient.get<BroadcastDetail>("/api/broadcasts/b-1");
      expect(getSpy).toHaveBeenCalledWith("/api/broadcasts/b-1");
      expect(res.data.status).toBe("completed");
      expect(res.data.counts.delivered).toBe(10);
    });

    it("fetches broadcast deliveries via apiClient", async () => {
      const getSpy = vi.spyOn(apiClient, "get").mockResolvedValue({
        data: [
          {
            id: "d-1",
            personId: "p-1",
            fullName: "John Doe",
            maskedPhone: "+234 *** *** 1234",
            channel: "telegram",
            status: "delivered",
            sentAt: "2026-11-03T00:01:00Z",
            deliveredAt: "2026-11-03T00:02:00Z",
            tappedOkAt: null,
            failedAt: null,
            createdAt: "2026-11-03T00:00:00Z",
          },
        ],
        meta: { nextCursor: null },
      });

      const res = await apiClient.get<DeliveryListItem[]>("/api/broadcasts/b-1/deliveries", { limit: 50 });
      expect(getSpy).toHaveBeenCalledWith("/api/broadcasts/b-1/deliveries", { limit: 50 });
      expect(res.data[0].channel).toBe("telegram");
      expect(res.data[0].maskedPhone).toBe("+234 *** *** 1234");
    });
  });
});
