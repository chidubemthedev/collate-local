import { useInfiniteQuery, useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api/client";
import type {
  AgentListItem,
  AgentsQueryFilters,
  AgentsSummaryFilters,
  AgentSummary,
  AvailableAgentItem,
} from "@/types/api";

export const AGENTS_KEYS = {
  all: ["agents"] as const,
  lists: () => [...AGENTS_KEYS.all, "list"] as const,
  list: (filters: AgentsQueryFilters) => [...AGENTS_KEYS.lists(), filters] as const,
  infinite: (filters: AgentsQueryFilters) => [...AGENTS_KEYS.all, "infinite", filters] as const,
  summary: (filters: AgentsSummaryFilters) => [...AGENTS_KEYS.all, "summary", filters] as const,
  available: (q: string) => [...AGENTS_KEYS.all, "available", { q }] as const,
};

/**
 * People who can be assigned as an agent (not yet agents, not admins), matching part of a name.
 * Shows the first page only, with the total, so the user narrows by typing rather than paging.
 */
export function useAvailableAgents(q: string, enabled = true) {
  return useQuery<{ items: AvailableAgentItem[]; total: number }, ApiClientError>({
    queryKey: AGENTS_KEYS.available(q),
    queryFn: async () => {
      const res = await apiClient.get<AvailableAgentItem[]>("/api/agents/available", { q });
      return { items: res.data, total: res.meta?.total ?? res.data.length };
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30,
  });
}

export interface AgentsResponse {
  items: AgentListItem[];
  nextCursor: string | null;
}

export const RECIPIENTS_PAGE_SIZE = 50;

/**
 * Paginated agents list that appends pages as the user asks for more.
 */
export function useAgentsInfinite(filters: Omit<AgentsQueryFilters, "cursor" | "limit"> = {}) {
  return useInfiniteQuery<AgentsResponse, ApiClientError>({
    queryKey: AGENTS_KEYS.infinite(filters),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.get<AgentListItem[]>("/api/agents", {
        ...filters,
        limit: RECIPIENTS_PAGE_SIZE,
        cursor: pageParam as string | null,
      });
      return { items: res.data, nextCursor: res.meta?.nextCursor ?? null };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
  });
}

/**
 * Aggregate agent counts for the same scope and geography filters.
 */
export function useAgentSummary(filters: AgentsSummaryFilters = {}) {
  return useQuery<AgentSummary, ApiClientError>({
    queryKey: AGENTS_KEYS.summary(filters),
    queryFn: async () => {
      const res = await apiClient.get<AgentSummary>("/api/agents/summary", { ...filters });
      return res.data;
    },
    placeholderData: keepPreviousData,
  });
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
      if (filters.personId !== undefined) params.set("personId", filters.personId);
      if (filters.agentKind !== undefined) params.set("agentKind", filters.agentKind);
      if (filters.channel !== undefined) params.set("channel", filters.channel);
      if (filters.q !== undefined) params.set("q", filters.q);
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
    // Keep the last results on screen while a filter change loads.
    placeholderData: keepPreviousData,
  });
}
