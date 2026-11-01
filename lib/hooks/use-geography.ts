"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api/client";
import type {
  StateCoverage,
  LgaCoverage,
  WardCoverage,
  PollingUnit,
} from "@/types/api";

export const GEOGRAPHY_KEYS = {
  all: ["geography"] as const,
  states: () => ["geography", "states"] as const,
  state: (stateId: number | string) => ["geography", "states", stateId] as const,
  lgas: (stateId: number | string) => ["geography", "states", stateId, "lgas"] as const,
  wards: (lgaId: number | string) => ["geography", "lgas", lgaId, "wards"] as const,
  pollingUnits: (wardId: number | string) => ["geography", "wards", wardId, "polling-units"] as const,
};

/**
 * Fetch all states accessible to the current user with their coverage counts.
 */
export function useGeographyStates() {
  return useQuery<StateCoverage[], ApiClientError>({
    queryKey: GEOGRAPHY_KEYS.states(),
    queryFn: async () => {
      const res = await apiClient.get<StateCoverage[]>("/api/geography/states");
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
export function useGeographyLgas(stateId?: number | string | null) {
  const validId = stateId && stateId !== "all" ? Number(stateId) : null;

  return useQuery<LgaCoverage[], ApiClientError>({
    queryKey: GEOGRAPHY_KEYS.lgas(validId ?? 0),
    queryFn: async () => {
      const res = await apiClient.get<LgaCoverage[]>(`/api/geography/states/${validId}/lgas`);
      return res.data;
    },
    enabled: Boolean(validId && !Number.isNaN(validId)),
    staleTime: 1000 * 60 * 3,
  });
}

/**
 * Fetch Wards in a given LGA.
 */
export function useGeographyWards(lgaId?: number | string | null) {
  const validId = lgaId && lgaId !== "all" ? Number(lgaId) : null;

  return useQuery<WardCoverage[], ApiClientError>({
    queryKey: GEOGRAPHY_KEYS.wards(validId ?? 0),
    queryFn: async () => {
      const res = await apiClient.get<WardCoverage[]>(`/api/geography/lgas/${validId}/wards`);
      return res.data;
    },
    enabled: Boolean(validId && !Number.isNaN(validId)),
    staleTime: 1000 * 60 * 3,
  });
}

/**
 * Fetch Polling Units in a given Ward.
 */
export function useGeographyPollingUnits(wardId?: number | string | null) {
  const validId = wardId && wardId !== "all" ? Number(wardId) : null;

  return useQuery<PollingUnit[], ApiClientError>({
    queryKey: GEOGRAPHY_KEYS.pollingUnits(validId ?? 0),
    queryFn: async () => {
      const res = await apiClient.get<PollingUnit[]>(`/api/geography/wards/${validId}/polling-units`);
      return res.data;
    },
    enabled: Boolean(validId && !Number.isNaN(validId)),
    staleTime: 1000 * 60 * 3,
  });
}
