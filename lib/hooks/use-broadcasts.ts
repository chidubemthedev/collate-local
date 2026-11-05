"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api/client";
import type {
  AudienceFilter,
  AudiencePreview,
  BroadcastDetail,
  BroadcastListItem,
  BroadcastsPageResponse,
  BroadcastsQueryParams,
  CreateBroadcastInput,
  CreatedBroadcast,
  DeliveriesPageResponse,
  DeliveriesQueryParams,
  DeliveryListItem,
} from "@/types/api";

export const BROADCAST_KEYS = {
  all: ["broadcasts"] as const,
  lists: () => [...BROADCAST_KEYS.all, "list"] as const,
  list: (params?: BroadcastsQueryParams) =>
    [...BROADCAST_KEYS.lists(), params ?? {}] as const,
  details: () => [...BROADCAST_KEYS.all, "detail"] as const,
  detail: (id: string) => [...BROADCAST_KEYS.details(), id] as const,
  deliveries: (id: string, params?: DeliveriesQueryParams) =>
    [...BROADCAST_KEYS.detail(id), "deliveries", params ?? {}] as const,
  preview: (filter: AudienceFilter) =>
    [...BROADCAST_KEYS.all, "preview", filter] as const,
};

/**
 * Fetch a cursor-paginated list of broadcasts.
 */
export function useBroadcasts(
  params?: BroadcastsQueryParams,
  options?: { enabled?: boolean },
) {
  return useQuery<BroadcastsPageResponse, ApiClientError>({
    queryKey: BROADCAST_KEYS.list(params),
    queryFn: async () => {
      const queryParams: Record<string, string | number> = {};
      if (params?.limit !== undefined) queryParams.limit = params.limit;
      if (params?.cursor) queryParams.cursor = params.cursor;

      const res = await apiClient.get<BroadcastListItem[]>(
        "/api/broadcasts",
        queryParams,
      );
      return {
        items: res.data,
        nextCursor: res.meta?.nextCursor ?? null,
      };
    },
    enabled: options?.enabled ?? true,
  });
}

/**
 * Fetch detail and delivery counts for a specific broadcast campaign.
 */
export function useBroadcastDetail(
  id: string,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  return useQuery<BroadcastDetail, ApiClientError>({
    queryKey: BROADCAST_KEYS.detail(id),
    queryFn: async () => {
      const res = await apiClient.get<BroadcastDetail>(`/api/broadcasts/${id}`);
      return res.data;
    },
    enabled: Boolean(id) && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval,
  });
}

/**
 * Fetch cursor-paginated recipient delivery logs for a specific broadcast.
 */
export function useBroadcastDeliveries(
  id: string,
  params?: DeliveriesQueryParams,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  return useQuery<DeliveriesPageResponse, ApiClientError>({
    queryKey: BROADCAST_KEYS.deliveries(id, params),
    queryFn: async () => {
      const queryParams: Record<string, string | number> = {};
      if (params?.limit !== undefined) queryParams.limit = params.limit;
      if (params?.cursor) queryParams.cursor = params.cursor;

      const res = await apiClient.get<DeliveryListItem[]>(
        `/api/broadcasts/${id}/deliveries`,
        queryParams,
      );
      return {
        items: res.data,
        nextCursor: res.meta?.nextCursor ?? null,
      };
    },
    enabled: Boolean(id) && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval,
  });
}

/**
 * Fetch audience recipient counts for a given audience filter.
 */
export function useAudiencePreview(
  filter: AudienceFilter,
  options?: { enabled?: boolean },
) {
  return useQuery<AudiencePreview, ApiClientError>({
    queryKey: BROADCAST_KEYS.preview(filter),
    queryFn: async () => {
      const res = await apiClient.post<AudiencePreview>(
        "/api/broadcasts/preview",
        filter,
      );
      return res.data;
    },
    enabled: options?.enabled ?? true,
    retry: false,
    // Keep the last counts on screen while a filter change loads.
    placeholderData: keepPreviousData,
  });
}

/**
 * Mutation to create and dispatch a new broadcast campaign.
 */
export function useCreateBroadcast() {
  const queryClient = useQueryClient();

  return useMutation<CreatedBroadcast, ApiClientError, CreateBroadcastInput>({
    mutationFn: async (payload: CreateBroadcastInput) => {
      const res = await apiClient.post<CreatedBroadcast>(
        "/api/broadcasts",
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BROADCAST_KEYS.lists() });
    },
  });
}
