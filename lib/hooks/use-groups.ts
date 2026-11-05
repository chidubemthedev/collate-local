"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api/client";

export interface OwnerGroup {
  id: number;
  name: string;
  type: "party" | "campaign" | "support_group" | string;
}

export const GROUPS_KEYS = {
  all: ["groups"] as const,
};

/**
 * Groups the current user may see as agent owners, for the Sponsor / owner filter.
 */
export function useOwnerGroups() {
  return useQuery<OwnerGroup[], ApiClientError>({
    queryKey: GROUPS_KEYS.all,
    queryFn: async () => {
      const res = await apiClient.get<OwnerGroup[]>("/api/groups");
      return res.data;
    },
    staleTime: 1000 * 60 * 10,
  });
}
