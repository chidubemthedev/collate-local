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
import { Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WF, PageHeader, LoadingBox, CenterSpinner } from "@/components/ui/wf";
import { apiClient } from "@/lib/api/client";
import { useAgentsInfinite, useAgentSummary } from "@/lib/hooks/use-agents";
import type { AgentsQueryFilters, AgentsSummaryFilters, CandidateCoverage } from "@/types/api";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 25;

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

  const notYet = (label: string, dark = false) => (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} className="inline-flex cursor-not-allowed" />}>
        <button type="button" disabled className={dark ? WF.btnDark : WF.btnOutline}>
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent>Not available yet</TooltipContent>
    </Tooltip>
  );

  return (
    <div className="flex w-full min-w-0 flex-col gap-3.5 text-[#0A0A0A] sm:gap-4">
      <PageHeader
        title="Recipients & Directory"
        subtitle="The registered list: only people on it can receive messages"
        actions={
          <>
            {/* Neither action has an API yet. */}
            {notYet("Import CSV")}
            {notYet("Add person", true)}
          </>
        }
      />

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

      {agentsQuery.isPending ? (
        <LoadingBox>Loading recipients…</LoadingBox>
      ) : (
        <section aria-busy={listRefreshing} className="relative min-w-0">
          <CenterSpinner show={listRefreshing} />
          <div className={`transition-opacity ${listRefreshing ? "pointer-events-none opacity-40" : ""}`}>
            <RecipientsTable
              recipients={pageRows}
              isLoading={false}
              isError={agentsQuery.isError && recipients.length === 0}
              onRetry={() => void agentsQuery.refetch()}
            />
          </div>
        </section>
      )}

      {totalItems > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12px] text-[#737373]">
            Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, totalItems)} of {totalItems.toLocaleString()}
            {hasMore ? "+" : ""} {totalItems === 1 ? "person" : "people"}. * Phone numbers are masked; Telegram shows whether
            the person has linked the bot.
          </span>
          {totalPages > 1 || hasMore ? (
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                className={WF.btnOutline}
                onClick={() => setPage(Math.max(1, safePage - 1))}
                disabled={safePage <= 1}
              >
                Previous
              </button>
              <span className="px-1 text-[12px] text-[#737373]">
                Page {safePage} of {totalPages}
                {hasMore ? "+" : ""}
              </span>
              <button
                type="button"
                className={WF.btnOutline}
                onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                disabled={safePage >= totalPages}
              >
                Next
                {isFetchingNextPage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              </button>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
