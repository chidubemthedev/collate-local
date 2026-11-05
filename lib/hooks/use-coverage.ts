"use client";

import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api/client";
import { GEOGRAPHY_KEYS } from "@/lib/hooks/use-geography";
import type {
  CandidateCoverage,
  CandidateOfficeOption,
  CoverageSummary,
  CoverageMapPointsResponse,
  CoverageGap,
  CoverageGapsResponse,
  CreateAssignmentPayload,
  CreateAssignmentResponse,
} from "@/types/api";

export interface CoverageFilters {
  stateId?: number | null;
  lgaId?: number | null;
  wardId?: number | null;
  politicalUnitId?: number | null;
}

export type PollingUnitFilterParams = { gps?: "with" | "without"; coverage?: "gaps" };

export interface CoverageGapsFilters extends CoverageFilters {
  limit?: number;
  offset?: number;
}

export const COVERAGE_KEYS = {
  all: ["coverage"] as const,
  summary: (filters: CoverageFilters) => ["coverage", "summary", filters] as const,
  mapPoints: (filters: CoverageFilters) => ["coverage", "map-points", filters] as const,
  gaps: (filters: CoverageGapsFilters) => ["coverage", "gaps", filters] as const,
};

/**
 * Fetch headline coverage metrics for the current scope.
 */
export function useCoverageSummary(
  filters: CoverageFilters & PollingUnitFilterParams = {},
  options?: { enabled?: boolean },
) {
  const cleanFilters: Record<string, number | string> = {};
  if (filters.gps) cleanFilters.gps = filters.gps;
  if (filters.coverage) cleanFilters.coverage = filters.coverage;
  if (filters.stateId && filters.stateId > 0) cleanFilters.stateId = filters.stateId;
  if (filters.lgaId && filters.lgaId > 0) cleanFilters.lgaId = filters.lgaId;
  if (filters.wardId && filters.wardId > 0) cleanFilters.wardId = filters.wardId;
  if (filters.politicalUnitId && filters.politicalUnitId > 0) cleanFilters.politicalUnitId = filters.politicalUnitId;

  const summaryKey = COVERAGE_KEYS.summary(cleanFilters as CoverageFilters);
  return useQuery<CoverageSummary, ApiClientError>({
    queryKey: summaryKey,
    queryFn: async () => {
      const res = await apiClient.get<CoverageSummary>("/api/coverage/summary", cleanFilters);
      return res.data;
    },
    staleTime: 1000 * 60 * 2,
    enabled: options?.enabled ?? true,
    // Keep the last numbers on screen while a filter change loads.
    placeholderData: keepPreviousData,
  });
}

/**
 * Fetch grouped GPS locations and official-agent counts for the current scope.
 */
export function useCoverageMapPoints(
  filters: CoverageFilters = {},
  options?: { enabled?: boolean },
) {
  const cleanFilters: Record<string, number> = {};
  if (filters.stateId && filters.stateId > 0) cleanFilters.stateId = filters.stateId;
  if (filters.lgaId && filters.lgaId > 0) cleanFilters.lgaId = filters.lgaId;
  if (filters.wardId && filters.wardId > 0) cleanFilters.wardId = filters.wardId;
  if (filters.politicalUnitId && filters.politicalUnitId > 0) {
    cleanFilters.politicalUnitId = filters.politicalUnitId;
  }

  return useQuery<CoverageMapPointsResponse, ApiClientError>({
    queryKey: COVERAGE_KEYS.mapPoints(cleanFilters),
    queryFn: async () => {
      const res = await apiClient.get<CoverageMapPointsResponse>(
        "/api/coverage/map-points",
        cleanFilters,
      );
      return res.data;
    },
    staleTime: 1000 * 60 * 3,
    enabled: options?.enabled ?? true,
  });
}

const CANDIDATE_COVERAGE_PAGE_SIZE = 12;

export interface CandidateCoveragePage {
  items: CandidateCoverage[];
  nextCursor: string | null;
  total: number;
  offices: CandidateOfficeOption[] | null;
}

/**
 * Fetch candidates whose seats fall in the current scope, with their coverage.
 */
export function useCandidateCoverage(
  filters: CoverageFilters & { officeId?: number | null; nationalOnly?: boolean } = {},
) {
  const cleanFilters: Record<string, number | string> = {};
  if (filters.stateId && filters.stateId > 0) cleanFilters.stateId = filters.stateId;
  if (filters.lgaId && filters.lgaId > 0) cleanFilters.lgaId = filters.lgaId;
  if (filters.wardId && filters.wardId > 0) cleanFilters.wardId = filters.wardId;
  if (filters.officeId && filters.officeId > 0) cleanFilters.officeId = filters.officeId;
  if (filters.nationalOnly) cleanFilters.nationalOnly = "true";

  return useInfiniteQuery<CandidateCoveragePage, ApiClientError>({
    queryKey: [...COVERAGE_KEYS.all, "candidates", cleanFilters] as const,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.get<CandidateCoverage[]>("/api/coverage/candidates", {
        ...cleanFilters,
        limit: CANDIDATE_COVERAGE_PAGE_SIZE,
        cursor: pageParam as string | null,
      });
      return {
        items: res.data,
        nextCursor: res.meta?.nextCursor ?? null,
        total: res.meta?.total ?? res.data.length,
        offices: res.meta?.offices ?? null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Fetch polling units lacking official agents (coverage gaps).
 */
export function useCoverageGaps(
  filters: CoverageGapsFilters = {},
  options?: { enabled?: boolean }
) {
  const cleanFilters: Record<string, number> = {};
  if (filters.stateId && filters.stateId > 0) cleanFilters.stateId = filters.stateId;
  if (filters.lgaId && filters.lgaId > 0) cleanFilters.lgaId = filters.lgaId;
  if (filters.wardId && filters.wardId > 0) cleanFilters.wardId = filters.wardId;
  if (filters.limit) cleanFilters.limit = filters.limit;
  if (filters.offset) cleanFilters.offset = filters.offset;

  return useQuery<CoverageGapsResponse, ApiClientError>({
    queryKey: COVERAGE_KEYS.gaps(cleanFilters),
    queryFn: async () => {
      const res = await apiClient.get<CoverageGapsResponse>("/api/coverage/gaps", cleanFilters);
      return res.data;
    },
    staleTime: 1000 * 60 * 2,
    enabled: options?.enabled ?? true,
    // Keep the last results on screen while a filter change loads.
    placeholderData: keepPreviousData,
  });
}

/**
 * Mutation to create an official or extra agent assignment.
 */
export function useCreateAssignment() {
  const queryClient = useQueryClient();

  return useMutation<CreateAssignmentResponse, ApiClientError, CreateAssignmentPayload>({
    mutationFn: async (payload) => {
      const kind = payload.agentKind || payload.role || "official";
      const body = {
        pollingUnitId: payload.pollingUnitId,
        personId: payload.personId,
        agentKind: kind,
        slotNumber: payload.slotNumber ?? (kind === "extra" ? 1 : 0),
        ownerGroupId: payload.ownerGroupId ?? null,
        ownerCandidateId: payload.ownerCandidateId ?? null,
      };
      const res = await apiClient.post<CreateAssignmentResponse>("/api/coverage/assignments", body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COVERAGE_KEYS.all });
      queryClient.invalidateQueries({ queryKey: GEOGRAPHY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

/**
 * Mutation to remove an agent assignment.
 */
export function useDeleteAssignment() {
  const queryClient = useQueryClient();

  return useMutation<{ ok: boolean }, ApiClientError, string>({
    mutationFn: async (assignmentId: string) => {
      const res = await apiClient.delete<{ ok: boolean }>(`/api/coverage/assignments/${assignmentId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COVERAGE_KEYS.all });
      queryClient.invalidateQueries({ queryKey: GEOGRAPHY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}
