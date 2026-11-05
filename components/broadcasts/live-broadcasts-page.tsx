"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/hooks/use-auth";
import type { BroadcastListItem, BroadcastStatus } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCardSkeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type BroadcastTab = "all" | "sent" | "scheduled" | "draft";

const TABS: Array<{ id: BroadcastTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "sent", label: "Sent" },
  { id: "scheduled", label: "Scheduled" },
  { id: "draft", label: "Drafts" },
];

// "Sent" covers broadcasts that have gone out, finished or still sending.
function tabOf(status: BroadcastStatus): BroadcastTab | null {
  if (status === "completed" || status === "sending") return "sent";
  if (status === "scheduled") return "scheduled";
  if (status === "draft") return "draft";
  return null;
}

const STATUS_PILL: Record<BroadcastStatus, { label: string; className: string }> = {
  completed: { label: "Sent", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  sending: { label: "Sending", className: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300" },
  scheduled: { label: "Scheduled", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  failed: { label: "Failed", className: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

const PAGE_SIZE = 10;

const KPI_CARD = "flex h-full flex-col rounded-xl border border-border/60 bg-card p-4";
const KPI_LABEL = "text-[11px] font-medium text-foreground/80";
const KPI_VALUE = "mt-3 text-xl md:text-2xl font-bold tracking-tight text-foreground tabular-nums";
const KPI_NOTE = "mt-3 text-[10px] text-muted-foreground";

function deliveryTotal(item: BroadcastListItem): number {
  const counts = item.deliveryCounts;
  return counts.pending + counts.sent + counts.delivered + counts.deliveredBySms +
    counts.failed + counts.tappedOk;
}

/** Delivered by Telegram or SMS; a tapped OK was delivered first, so it counts too. */
function deliveredCount(item: BroadcastListItem): number {
  const counts = item.deliveryCounts;
  return counts.delivered + counts.deliveredBySms + counts.tappedOk;
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day} ${time}`;
}

export default function LiveBroadcastsPage() {
  const [tab, setTab] = useState<BroadcastTab>("all");
  const [search, setSearch] = useState("");
  const [pageState, setPageState] = useState({ key: "", page: 1 });
  const { data: session } = useSession();
  const myPersonId = session?.person?.id ?? null;

  const broadcastsQuery = useInfiniteQuery({
    queryKey: ["broadcasts", "list"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => apiClient.get<BroadcastListItem[]>("/api/broadcasts", {
      limit: 100,
      cursor: pageParam,
    }),
    getNextPageParam: (lastPage) => lastPage.meta?.nextCursor ?? undefined,
  });

  const pages = broadcastsQuery.data?.pages;
  const broadcasts = useMemo(() => pages?.flatMap((page) => page.data) ?? [], [pages]);

  // Card figures, from the broadcasts loaded so far.
  const kpis = useMemo(() => {
    let sentBroadcasts = 0;
    let messages = 0;
    let delivered = 0;
    let tappedOk = 0;
    for (const broadcast of broadcasts) {
      if (tabOf(broadcast.status) === "sent") sentBroadcasts += 1;
      messages += deliveryTotal(broadcast);
      delivered += deliveredCount(broadcast);
      tappedOk += broadcast.deliveryCounts.tappedOk;
    }
    return {
      broadcasts: broadcasts.length,
      sentBroadcasts,
      messages,
      delivered,
      deliveredPct: percent(delivered, messages),
      tappedOk,
      tappedOkPct: percent(tappedOk, messages),
    };
  }, [broadcasts]);

  const tabCounts = useMemo(() => {
    const counts: Record<BroadcastTab, number> = { all: broadcasts.length, sent: 0, scheduled: 0, draft: 0 };
    for (const broadcast of broadcasts) {
      const owner = tabOf(broadcast.status);
      if (owner) counts[owner] += 1;
    }
    return counts;
  }, [broadcasts]);

  const filteredBroadcasts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return broadcasts.filter((broadcast) => {
      if (tab !== "all" && tabOf(broadcast.status) !== tab) return false;
      if (!query) return true;
      return [
        broadcast.title,
        broadcast.messageText,
        broadcast.sender.displayName,
        ...broadcast.audienceSummary,
      ].some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [broadcasts, search, tab]);

  // Pagination: back to page 1 when the tab or search changes, not when more rows load.
  const listKey = `${tab}|${search.trim()}`;
  const currentPage = pageState.key === listKey ? pageState.page : 1;
  const setPage = (page: number) => setPageState({ key: listKey, page });
  const hasMore = Boolean(broadcastsQuery.hasNextPage);
  // Unfiltered, more rows may exist on the server; filtered, only the loaded rows are known.
  const totalItems = filteredBroadcasts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageRows = filteredBroadcasts.slice(startIndex, startIndex + PAGE_SIZE);
  const onLastLoadedPage = safePage === totalPages;

  // Reaching the last loaded page pulls in the next batch from the server.
  const { fetchNextPage, isFetchingNextPage } = broadcastsQuery;
  const loadMore = useCallback(() => void fetchNextPage(), [fetchNextPage]);
  useEffect(() => {
    if (onLastLoadedPage && hasMore && !isFetchingNextPage) loadMore();
  }, [onLastLoadedPage, hasMore, isFetchingNextPage, loadMore]);

  const isRefreshing = broadcastsQuery.isFetching && !isFetchingNextPage && !broadcastsQuery.isPending;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">Broadcasts</h1>
          <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground">
            Broadcasts you sent to people below you
          </p>
        </div>
        <Link
          href="/broadcasts/new"
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-medium text-background transition-colors hover:bg-foreground/90"
        >
          <Plus className="h-3.5 w-3.5" />
          New broadcast
        </Link>
      </header>

      {broadcastsQuery.isPending ? (
        <StatCardSkeleton count={4} />
      ) : (
        <div
          aria-busy={isRefreshing}
          className={`grid grid-cols-2 gap-3 lg:grid-cols-4 transition-opacity ${isRefreshing ? "opacity-60" : ""}`}
        >
          <div className={KPI_CARD}>
            <div className={KPI_LABEL}>Broadcasts</div>
            <div className={KPI_VALUE}>{kpis.broadcasts.toLocaleString()}</div>
            <div className={KPI_NOTE}>{kpis.sentBroadcasts.toLocaleString()} sent</div>
          </div>
          <div className={KPI_CARD}>
            <div className={KPI_LABEL}>Messages sent</div>
            <div className={KPI_VALUE}>{kpis.messages.toLocaleString()}</div>
            <div className={KPI_NOTE}>in this list</div>
          </div>
          <div className={KPI_CARD}>
            <div className={KPI_LABEL}>Delivered</div>
            <div className={KPI_VALUE}>{kpis.deliveredPct}%</div>
            <div className={KPI_NOTE}>{kpis.delivered.toLocaleString()} people</div>
          </div>
          <div className={KPI_CARD}>
            <div className={KPI_LABEL}>Tapped OK</div>
            <div className={KPI_VALUE}>{kpis.tappedOkPct}%</div>
            <div className={KPI_NOTE}>{kpis.tappedOk.toLocaleString()} people</div>
          </div>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-muted/70 p-1 scrollbar-none">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition-colors ${
                active
                  ? "bg-background font-semibold text-foreground shadow-sm"
                  : "font-medium text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{item.label}</span>
              <span
                className={`rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums ${
                  active ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                }`}
              >
                {tabCounts[item.id].toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title, message, audience or sender"
          aria-label="Search broadcasts"
          className="h-10 w-full rounded-full border-border/70 bg-card pl-10 text-xs"
        />
      </div>

      {/* Table */}
      <section
        aria-busy={isRefreshing}
        className="relative min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card"
      >
        {broadcastsQuery.isPending ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Loading broadcasts…
          </div>
        ) : broadcastsQuery.isError && broadcasts.length === 0 ? (
          <div className="space-y-3 p-8 text-center">
            <AlertCircle className="mx-auto h-6 w-6 text-destructive" />
            <p className="text-sm text-destructive">{broadcastsQuery.error.message}</p>
            <Button variant="outline" size="sm" onClick={() => void broadcastsQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />Retry
            </Button>
          </div>
        ) : (
          <>
            <div className={`overflow-x-auto transition-opacity ${isRefreshing ? "pointer-events-none opacity-40" : ""}`}>
              <Table>
                <TableHeader className="text-[11px]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[260px] pl-4 font-semibold text-foreground">Broadcast</TableHead>
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                    <TableHead
                      className="font-semibold text-foreground whitespace-nowrap"
                      title="Everyone the broadcast went to"
                    >
                      Audience *
                    </TableHead>
                    <TableHead
                      className="min-w-[140px] font-semibold text-foreground whitespace-nowrap"
                      title="Delivered by Telegram or SMS, out of everyone in the audience"
                    >
                      Delivered *
                    </TableHead>
                    <TableHead
                      className="font-semibold text-foreground whitespace-nowrap"
                      title="Tapped the OK button, out of everyone in the audience"
                    >
                      Tapped OK *
                    </TableHead>
                    <TableHead className="font-semibold text-foreground">Date</TableHead>
                    <TableHead className="pr-4 text-right font-semibold text-foreground">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {pageRows.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                        {hasMore && isFetchingNextPage ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Loading broadcasts…
                          </span>
                        ) : broadcasts.length === 0 ? (
                          "No broadcasts yet."
                        ) : (
                          "No broadcasts match."
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((broadcast) => {
                      const counts = broadcast.deliveryCounts;
                      const total = deliveryTotal(broadcast);
                      const delivered = deliveredCount(broadcast);
                      const waiting = counts.pending + counts.sent;
                      const pill = STATUS_PILL[broadcast.status];
                      const notYetSent = broadcast.status === "draft" || broadcast.status === "scheduled";
                      const sender = myPersonId && broadcast.sender.id === myPersonId
                        ? "you"
                        : broadcast.sender.displayName;
                      const audience = broadcast.audienceSummary.join(", ");

                      return (
                        <TableRow key={broadcast.id} className="hover:bg-muted/30">
                          <TableCell className="max-w-[360px] pl-4">
                            <div className="truncate font-semibold text-foreground">
                              {broadcast.title || "Broadcast"}
                            </div>
                            <div className="mt-0.5 truncate text-muted-foreground" title={broadcast.messageText}>
                              {broadcast.messageText}
                            </div>
                            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {audience ? `${audience} · ` : ""}Sent by {sender}
                            </div>
                          </TableCell>

                          <TableCell>
                            <span
                              className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ${pill.className}`}
                            >
                              {pill.label}
                            </span>
                          </TableCell>

                          <TableCell className="whitespace-nowrap font-semibold text-foreground tabular-nums">
                            {total.toLocaleString()} {total === 1 ? "person" : "people"}
                          </TableCell>

                          <TableCell>
                            {notYetSent || total === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="w-[130px] space-y-1">
                                <div className="font-semibold text-foreground tabular-nums">
                                  {percent(delivered, total)}%
                                </div>
                                <div className="flex h-1 w-full overflow-hidden rounded-full bg-muted">
                                  <div className="h-full bg-emerald-600" style={{ width: `${percent(delivered, total)}%` }} />
                                  <div className="h-full bg-muted-foreground/40" style={{ width: `${percent(waiting, total)}%` }} />
                                  <div className="h-full bg-red-500" style={{ width: `${percent(counts.failed, total)}%` }} />
                                </div>
                                <div className="whitespace-nowrap text-[10px] text-muted-foreground">
                                  {counts.failed.toLocaleString()} failed · {waiting.toLocaleString()} pending
                                </div>
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="font-semibold tabular-nums">
                            {notYetSent || total === 0 ? (
                              <span className="font-normal text-muted-foreground">—</span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {percent(counts.tappedOk, total)}%
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="whitespace-nowrap text-foreground">
                            {formatDate(broadcast.scheduledSendAt ?? broadcast.createdAt)}
                          </TableCell>

                          <TableCell className="pr-4 text-right">
                            <Link
                              href={`/broadcasts/${broadcast.id}`}
                              className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                            >
                              View report
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {isRefreshing && (
              <div role="status" className="absolute inset-0 z-10 flex items-center justify-center">
                <span className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Loading broadcasts…
                </span>
              </div>
            )}

            {totalItems > 0 && (
              <div className="flex flex-col items-center justify-between gap-2.5 border-t border-border/60 px-4 py-3 text-xs sm:flex-row">
                <div className="text-muted-foreground">
                  Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, totalItems)} of{" "}
                  {totalItems.toLocaleString()}
                  {hasMore ? "+" : ""} broadcast{totalItems === 1 ? "" : "s"}
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
          </>
        )}
      </section>
    </div>
  );
}
