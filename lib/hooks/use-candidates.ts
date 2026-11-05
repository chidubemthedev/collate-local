"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api/client";
import type { CandidateCoverage, CandidateOfficeOption } from "@/types/api";
import type { CandidateData } from "@/lib/types";

export const CANDIDATES_QUERY_KEY = ["candidates"] as const;

export const CANDIDATES_PAGE_SIZE = 50;

export interface CandidatesPage {
  items: CandidateData[];
  nextCursor: string | null;
  total: number;
  offices: CandidateOfficeOption[] | null;
}

export interface CandidatesQueryFilters {
  officeId?: number;
}

function toCandidate(item: CandidateCoverage): CandidateData {
  return {
    id: item.id,
    office: item.office,
    seat: item.seat,
    stateCode: item.inecStateCode,
    name: item.name,
    deputyName: item.deputyName,
    isOffCycle: item.isOffCycle,
    totalPUs: item.totalPUs,
    coveredPUs: item.coveredPUs,
    coveragePct: item.coveragePct,
    extraAgentsCount: item.extraAgentsCount,
    phoneMasked: item.maskedPhone,
    telegramStatus: item.channelStatus,
  };
}

/**
 * One page (50) of /api/coverage/candidates at a time, following the keyset cursor
 * only when the user asks for more. The office filter is applied by the API.
 */
export function useCandidates(filters: CandidatesQueryFilters = {}) {
  const officeId = filters.officeId;
  return useInfiniteQuery<CandidatesPage, ApiClientError>({
    queryKey: [...CANDIDATES_QUERY_KEY, { officeId: officeId ?? null }],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.get<CandidateCoverage[]>("/api/coverage/candidates", {
        limit: CANDIDATES_PAGE_SIZE,
        cursor: pageParam as string | null,
        officeId,
      });
      return {
        items: res.data.map(toCandidate),
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
