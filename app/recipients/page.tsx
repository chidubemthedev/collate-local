"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { RecipientsKPISummary } from "@/components/recipients/recipients-kpi-summary";
import {
  RecipientsFilters,
  type RecipientGroupFilter,
  type TelegramStatusFilter,
} from "@/components/recipients/recipients-filters";
import { RecipientsTable } from "@/components/recipients/recipients-table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useAgentsInfinite, useAgentSummary } from "@/lib/hooks/use-agents";
import type { AgentsQueryFilters, AgentsSummaryFilters, CandidateCoverage } from "@/types/api";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 10;

function toId(value: string): number | undefined {
  return value === "all" ? undefined : Number(value);
}

export default function RecipientsPage() {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [group, setGroup] = useState<RecipientGroupFilter>("all");
  const [stateId, setStateId] = useState<string>("all");
  const [lgaId, setLgaId] = useState<string>("all");
  const [wardId, setWardId] = useState<string>("all");
  const [status, setStatus] = useState<TelegramStatusFilter>("all");
  const [pageState, setPageState] = useState({ key: "", page: 1 });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // The cards cover the area and search; group and status narrow only the list.
  const summaryFilters = useMemo<AgentsSummaryFilters>(
    () => ({
      ...(toId(stateId) !== undefined && { stateId: toId(stateId) }),
      ...(toId(lgaId) !== undefined && { lgaId: toId(lgaId) }),
      ...(toId(wardId) !== undefined && { wardId: toId(wardId) }),
      ...(debouncedSearch && { q: debouncedSearch }),
    }),
    [stateId, lgaId, wardId, debouncedSearch],
  );

  const listFilters = useMemo<Omit<AgentsQueryFilters, "cursor" | "limit">>(
    () => ({
      ...summaryFilters,
      ...(group !== "all" && { agentKind: group }),
      ...(status !== "all" && { channel: status }),
    }),
    [summaryFilters, group, status],
  );

  const summaryQuery = useAgentSummary(summaryFilters);
  const agentsQuery = useAgentsInfinite(listFilters);
  const recipients = useMemo(
    () => agentsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [agentsQuery.data],
  );

  // Pagination: back to page 1 when a filter changes, not when more rows load.
  const listKey = JSON.stringify(listFilters);
  const currentPage = pageState.key === listKey ? pageState.page : 1;
  const setPage = (page: number) => setPageState({ key: listKey, page });
  const hasMore = Boolean(agentsQuery.hasNextPage);
  const totalItems = recipients.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageRows = recipients.slice(startIndex, startIndex + PAGE_SIZE);

  // Reaching the last loaded page pulls in the next batch from the server.
  const { fetchNextPage, isFetchingNextPage } = agentsQuery;
  const loadMore = useCallback(() => void fetchNextPage(), [fetchNextPage]);
  const onLastLoadedPage = safePage === totalPages;
  useEffect(() => {
    if (onLastLoadedPage && hasMore && !isFetchingNextPage) loadMore();
  }, [onLastLoadedPage, hasMore, isFetchingNextPage, loadMore]);

  // NDC candidates whose seat overlaps the area; only the total is needed.
  const candidateArea = { stateId: toId(stateId), lgaId: toId(lgaId), wardId: toId(wardId) };
  const candidatesQuery = useQuery({
    queryKey: ["candidates", "count", candidateArea],
    queryFn: async () => {
      const res = await apiClient.get<CandidateCoverage[]>("/api/coverage/candidates", {
        countOnly: "true",
        overlapStateId: candidateArea.stateId,
        overlapLgaId: candidateArea.lgaId,
        overlapWardId: candidateArea.wardId,
      });
      return res.meta?.total ?? res.data.length;
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
  });

  const handleResetFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setGroup("all");
    setStateId("all");
    setLgaId("all");
    setWardId("all");
    setStatus("all");
  };

  const summary = summaryQuery.data;
  // A filter change refetches while the previous rows stay on screen.
  const listRefreshing =
    agentsQuery.isFetching && !agentsQuery.isFetchingNextPage && !agentsQuery.isPending;
  const cardsRefreshing =
    (summaryQuery.isFetching && !summaryQuery.isPending) ||
    (candidatesQuery.isFetching && !candidatesQuery.isPending);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">Recipients &amp; Directory</h1>
          <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground">
            The registered list: only people on it can receive messages
          </p>
        </div>
        {/* Neither action has an API yet. */}
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" disabled title="Not available yet" className="h-8 px-3 text-xs">
            Import CSV
          </Button>
          <Button
            disabled
            title="Not available yet"
            className="h-8 bg-foreground px-3 text-xs text-background hover:bg-foreground/90"
          >
            Add person
          </Button>
        </div>
      </div>

      <RecipientsFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        group={group}
        onGroupChange={setGroup}
        stateId={stateId}
        onStateChange={setStateId}
        lgaId={lgaId}
        onLgaChange={setLgaId}
        wardId={wardId}
        onWardChange={setWardId}
        status={status}
        onStatusChange={setStatus}
        onReset={handleResetFilters}
      />

      <RecipientsKPISummary
        summary={summary}
        candidateCount={candidatesQuery.isError ? undefined : candidatesQuery.data}
        isLoading={summaryQuery.isPending}
        isRefreshing={cardsRefreshing}
        isError={summaryQuery.isError}
        onRetry={() => void summaryQuery.refetch()}
      />

      <section
        aria-busy={listRefreshing}
        className="relative min-w-0 space-y-3 overflow-hidden rounded-xl border border-border/70 bg-card p-3 sm:p-4"
      >
        <div className={`transition-opacity ${listRefreshing ? "pointer-events-none opacity-40" : ""}`}>
          <RecipientsTable
            recipients={pageRows}
            isLoading={agentsQuery.isPending}
            isError={agentsQuery.isError && recipients.length === 0}
            onRetry={() => void agentsQuery.refetch()}
          />
        </div>
        {listRefreshing && (
          <div role="status" className="absolute inset-0 z-10 flex items-center justify-center">
            <span className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Loading recipients…
            </span>
          </div>
        )}
        {totalItems > 0 && (
          <div className="flex flex-col items-center justify-between gap-2.5 border-t border-border/60 pt-3 text-xs sm:flex-row">
            <div className="text-muted-foreground">
              Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, totalItems)} of{" "}
              {totalItems.toLocaleString()}
              {hasMore ? "+" : ""} {totalItems === 1 ? "person" : "people"}
            </div>
            {(totalPages > 1 || hasMore) && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, safePage - 1))}
                  disabled={safePage <= 1}
                  className="h-7 gap-1 px-2.5 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </Button>
                <span className="px-2 font-medium text-muted-foreground">
                  Page <span className="font-semibold text-foreground">{safePage}</span> of{" "}
                  <span className="font-semibold text-foreground">
                    {totalPages}
                    {hasMore ? "+" : ""}
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                  disabled={safePage >= totalPages}
                  className="h-7 gap-1 px-2.5 text-xs"
                >
                  Next
                  {isFetchingNextPage ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
