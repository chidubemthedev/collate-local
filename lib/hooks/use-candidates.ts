"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api/client";
import type { CandidateCoverage } from "@/types/api";
import type { CandidateData } from "@/lib/types";

export const CANDIDATES_QUERY_KEY = ["candidates"] as const;

const PAGE_SIZE = 500;
const MAX_PAGES = 20;

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
 * Fetch the full candidate registry from /api/coverage/candidates,
 * following the keyset cursor until every page is loaded.
 */
export function useCandidates() {
  return useQuery<CandidateData[], ApiClientError>({
    queryKey: CANDIDATES_QUERY_KEY,
    queryFn: async () => {
      const all: CandidateData[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < MAX_PAGES; page++) {
        const res: { data: CandidateCoverage[]; meta?: { nextCursor?: string | null } } =
          await apiClient.get<CandidateCoverage[]>("/api/coverage/candidates", {
            limit: PAGE_SIZE,
            cursor,
          });
        all.push(...res.data.map(toCandidate));
        cursor = res.meta?.nextCursor ?? null;
        if (!cursor) break;
      }
      return all;
    },
    staleTime: 1000 * 60 * 2,
  });
}
