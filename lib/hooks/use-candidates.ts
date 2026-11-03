"use client";

import { useQuery } from "@tanstack/react-query";
import { CANDIDATES_DATA } from "@/lib/data/candidates-data";
import { CandidateData } from "@/lib/types";

export const CANDIDATES_QUERY_KEY = ["candidates"] as const;

/**
 * Hook to fetch the NDC candidates list using TanStack Query.
 * Returns the candidate ticket registry with loading and error states.
 */
export function useCandidates() {
  return useQuery<CandidateData[], Error>({
    queryKey: CANDIDATES_QUERY_KEY,
    queryFn: async () => {
      // Returns validated candidate tickets data
      return CANDIDATES_DATA;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}
