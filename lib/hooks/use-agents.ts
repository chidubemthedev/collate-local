import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { AgentListItem, AgentsQueryFilters } from "@/types/api";

export const AGENTS_KEYS = {
  all: ["agents"] as const,
  lists: () => [...AGENTS_KEYS.all, "list"] as const,
  list: (filters: AgentsQueryFilters) => [...AGENTS_KEYS.lists(), filters] as const,
};

export interface AgentsResponse {
  items: AgentListItem[];
  nextCursor: string | null;
}

/**
 * Hook to fetch agents list filtered by geography or agent kind.
 */
export function useAgents(filters: AgentsQueryFilters = {}, options?: { enabled?: boolean }) {
  return useQuery<AgentsResponse>({
    queryKey: AGENTS_KEYS.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.stateId !== undefined) params.set("stateId", String(filters.stateId));
      if (filters.lgaId !== undefined) params.set("lgaId", String(filters.lgaId));
      if (filters.wardId !== undefined) params.set("wardId", String(filters.wardId));
      if (filters.politicalUnitId !== undefined) params.set("politicalUnitId", String(filters.politicalUnitId));
      if (filters.ownerGroupId !== undefined) params.set("ownerGroupId", String(filters.ownerGroupId));
      if (filters.ownerCandidateId !== undefined) params.set("ownerCandidateId", String(filters.ownerCandidateId));
      if (filters.agentKind !== undefined) params.set("agentKind", filters.agentKind);
      if (filters.cursor !== undefined) params.set("cursor", filters.cursor);
      if (filters.limit !== undefined) params.set("limit", String(filters.limit));

      const queryString = params.toString();
      const endpoint = queryString ? `/api/agents?${queryString}` : "/api/agents";

      const res = await apiClient.get<AgentListItem[]>(endpoint);
      return {
        items: res.data,
        nextCursor: res.meta?.nextCursor ?? null,
      };
    },
    enabled: options?.enabled ?? true,
  });
}
