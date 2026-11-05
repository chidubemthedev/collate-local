"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api/client";
import type {
  StateCoverage,
  LgaCoverage,
  WardCoverage,
  PollingUnit,
} from "@/types/api";

export interface PollingUnitFilterParams {
  gps?: "with" | "without";
  coverage?: "gaps";
}

function puFilterQuery(filter?: PollingUnitFilterParams): Record<string, string> {
  const query: Record<string, string> = {};
  if (filter?.gps) query.gps = filter.gps;
  if (filter?.coverage) query.coverage = filter.coverage;
  return query;
}

export const GEOGRAPHY_KEYS = {
  all: ["geography"] as const,
  states: (filter?: PollingUnitFilterParams) => ["geography", "states", puFilterQuery(filter)] as const,
  state: (stateId: number | string) => ["geography", "states", stateId] as const,
  lgas: (stateId: number | string, filter?: PollingUnitFilterParams) =>
    ["geography", "states", stateId, "lgas", puFilterQuery(filter)] as const,
  wards: (lgaId: number | string, filter?: PollingUnitFilterParams) =>
    ["geography", "lgas", lgaId, "wards", puFilterQuery(filter)] as const,
  pollingUnits: (wardId: number | string) => ["geography", "wards", wardId, "polling-units"] as const,
};

/**
 * Fetch all states accessible to the current user with their coverage counts.
 */
export function useGeographyStates(filter?: PollingUnitFilterParams) {
  return useQuery<StateCoverage[], ApiClientError>({
    queryKey: GEOGRAPHY_KEYS.states(filter),
    queryFn: async () => {
      const res = await apiClient.get<StateCoverage[]>("/api/geography/states", puFilterQuery(filter));
      return res.data;
    },
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

/**
 * Fetch a single state by ID.
 */
export function useGeographyState(stateId?: number | string | null) {
  const validId = stateId && stateId !== "all" ? Number(stateId) : null;

  return useQuery<StateCoverage, ApiClientError>({
    queryKey: GEOGRAPHY_KEYS.state(validId ?? 0),
    queryFn: async () => {
      const res = await apiClient.get<StateCoverage>(`/api/geography/states/${validId}`);
      return res.data;
    },
    enabled: Boolean(validId && !Number.isNaN(validId)),
    staleTime: 1000 * 60 * 3,
  });
}

/**
 * Fetch LGAs in a given state.
 */
export function useGeographyLgas(stateId?: number | string | null, filter?: PollingUnitFilterParams) {
  const validId = stateId && stateId !== "all" ? Number(stateId) : null;

  return useQuery<LgaCoverage[], ApiClientError>({
    queryKey: GEOGRAPHY_KEYS.lgas(validId ?? 0, filter),
    queryFn: async () => {
      const res = await apiClient.get<LgaCoverage[]>(
        `/api/geography/states/${validId}/lgas`,
        puFilterQuery(filter),
      );
      return res.data;
    },
    enabled: Boolean(validId && !Number.isNaN(validId)),
    staleTime: 1000 * 60 * 3,
  });
}

/**
 * Fetch Wards in a given LGA.
 */
export function useGeographyWards(lgaId?: number | string | null, filter?: PollingUnitFilterParams) {
  const validId = lgaId && lgaId !== "all" ? Number(lgaId) : null;

  return useQuery<WardCoverage[], ApiClientError>({
    queryKey: GEOGRAPHY_KEYS.wards(validId ?? 0, filter),
    queryFn: async () => {
      const res = await apiClient.get<WardCoverage[]>(
        `/api/geography/lgas/${validId}/wards`,
        puFilterQuery(filter),
      );
      return res.data;
    },
    enabled: Boolean(validId && !Number.isNaN(validId)),
    staleTime: 1000 * 60 * 3,
  });
}

/**
 * Fetch Polling Units in a given Ward.
 */
export function useGeographyPollingUnits(wardId?: number | string | null, gps?: "with" | "without") {
  const validId = wardId && wardId !== "all" ? Number(wardId) : null;

  return useQuery<PollingUnit[], ApiClientError>({
    queryKey: [...GEOGRAPHY_KEYS.pollingUnits(validId ?? 0), gps ?? "all"],
    queryFn: async () => {
      const items: PollingUnit[] = [];
      let cursor: string | undefined;

      do {
        const res = await apiClient.get<PollingUnit[]>(
          `/api/geography/wards/${validId}/polling-units`,
          { limit: 100, cursor, gps },
        );
        items.push(...res.data);
        cursor = res.meta?.nextCursor ?? undefined;
      } while (cursor);

      return items;
    },
    enabled: Boolean(validId && !Number.isNaN(validId)),
    staleTime: 1000 * 60 * 3,
  });
}
