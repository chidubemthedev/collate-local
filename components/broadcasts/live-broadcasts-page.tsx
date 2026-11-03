"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AlertCircle, Download, Plus, RefreshCw, Search, Send } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import type { BroadcastListItem, BroadcastStatus } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CardListSkeleton, StatCardSkeleton } from "@/components/ui/skeleton";
import { TableToolbar } from "@/components/ui/table-toolbar";

const statuses: Array<"all" | BroadcastStatus> = [
  "all",
  "draft",
  "scheduled",
  "sending",
  "completed",
  "failed",
  "cancelled",
];

function labelStatus(status: BroadcastStatus): string {
  return status.replaceAll("_", " ");
}

function formatDate(value: string | null): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

function escapeCsv(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function deliveryTotal(item: BroadcastListItem): number {
  const counts = item.deliveryCounts;
  return counts.pending + counts.sent + counts.delivered + counts.deliveredBySms +
    counts.failed + counts.tappedOk;
}

export default function LiveBroadcastsPage() {
  const [status, setStatus] = useState<"all" | BroadcastStatus>("all");
  const [search, setSearch] = useState("");
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
  const filteredBroadcasts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return broadcasts.filter((broadcast) => {
      if (status !== "all" && broadcast.status !== status) return false;
      if (!query) return true;
      return [
        broadcast.title,
        broadcast.messageText,
        broadcast.sender.displayName,
        ...broadcast.audienceSummary,
      ].some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [broadcasts, search, status]);

  const exportCsv = () => {
    const rows = [
      ["ID", "Title", "Status", "Sender", "Audience", "Pending", "Sent", "Delivered", "Delivered by SMS", "Failed", "Tapped OK", "Scheduled at", "Created at"],
      ...filteredBroadcasts.map((broadcast) => [
        broadcast.id,
        broadcast.title,
        broadcast.status,
        broadcast.sender.displayName,
        broadcast.audienceSummary.join("; "),
        broadcast.deliveryCounts.pending,
        broadcast.deliveryCounts.sent,
        broadcast.deliveryCounts.delivered,
        broadcast.deliveryCounts.deliveredBySms,
        broadcast.deliveryCounts.failed,
        broadcast.deliveryCounts.tappedOk,
        broadcast.scheduledSendAt ?? "",
        broadcast.createdAt,
      ]),
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "broadcasts.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Send className="h-6 w-6 text-primary" />
            Broadcasts
          </h1>
        </div>
      </header>

      {broadcastsQuery.isPending ? (
        <StatCardSkeleton count={3} />
      ) : <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Broadcasts loaded</p>
          <p className="mt-1 text-2xl font-semibold">{broadcasts.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Pending deliveries</p>
          <p className="mt-1 text-2xl font-semibold">
            {broadcasts.reduce((sum, item) => sum + item.deliveryCounts.pending, 0)}
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Delivered</p>
          <p className="mt-1 text-2xl font-semibold">
            {broadcasts.reduce((sum, item) => sum + item.deliveryCounts.delivered + item.deliveryCounts.deliveredBySms, 0)}
          </p>
        </CardContent></Card>
      </div>}

      <section className="min-w-0 space-y-3 overflow-hidden rounded-xl border border-border/70 bg-card p-3 sm:p-4">
      <TableToolbar
        onClear={() => {
          setStatus("all");
          setSearch("");
        }}
        activeFilters={[
          ...(status !== "all" ? [{ id: "status", label: `Status: ${labelStatus(status)}`, onRemove: () => setStatus("all") }] : []),
          ...(search ? [{ id: "search", label: `Search: ${search}`, onRemove: () => setSearch("") }] : []),
        ]}
        actions={
          <>
            <Link
              href="/broadcasts/new"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              <Plus className="h-4 w-4" />New Broadcast
            </Link>
            <Button variant="outline" onClick={exportCsv} disabled={filteredBroadcasts.length === 0}>
              <Download className="mr-2 h-4 w-4" />Export loaded rows
            </Button>
          </>
        }
      >
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-[minmax(12rem,1fr)_12rem]">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, sender, audience, or message"
            className="pl-9"
          />
        </div>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => setStatus(event.target.value as "all" | BroadcastStatus)}
          className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm"
        >
          {statuses.map((value) => (
            <option key={value} value={value}>
              {value === "all" ? "All statuses" : labelStatus(value)}
            </option>
          ))}
        </select>
        </div>
      </TableToolbar>

      {broadcastsQuery.isPending ? (
        <CardListSkeleton count={4} />
      ) : broadcastsQuery.isError ? (
        <div className="space-y-3 rounded-lg border border-destructive/30 p-8 text-center">
          <AlertCircle className="mx-auto h-6 w-6 text-destructive" />
          <p className="text-sm text-destructive">{broadcastsQuery.error.message}</p>
          <Button variant="outline" onClick={() => void broadcastsQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />Retry
          </Button>
        </div>
      ) : filteredBroadcasts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          {broadcasts.length === 0 ? "No broadcasts are available." : "No broadcasts match these filters."}
        </div>
      ) : (
        <div
          aria-busy={broadcastsQuery.isFetching}
          className={`divide-y divide-border/60 ${broadcastsQuery.isFetching ? "opacity-60" : ""}`}
        >
          {filteredBroadcasts.map((broadcast) => {
            const counts = broadcast.deliveryCounts;
            return (
              <div key={broadcast.id} className="space-y-3 py-4 first:pt-1 last:pb-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/broadcasts/${broadcast.id}`}
                        className="font-semibold hover:text-primary hover:underline"
                      >
                        {broadcast.title || "Broadcast"}
                      </Link>
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {broadcast.messageText}
                      </p>
                    </div>
                    <Badge variant="outline">{labelStatus(broadcast.status)}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                    <span>Sender: {broadcast.sender.displayName}</span>
                    <span>Audience: {broadcast.audienceSummary.join(", ")}</span>
                    <span>
                      {broadcast.scheduledSendAt ? "Scheduled" : "Created"}:{" "}
                      {formatDate(broadcast.scheduledSendAt ?? broadcast.createdAt)}
                    </span>
                    <span>{deliveryTotal(broadcast)} delivery records</span>
                  </div>
                  <div className="flex flex-wrap gap-3 border-t pt-3 text-xs">
                    <span>Pending: {counts.pending}</span>
                    <span>Sent: {counts.sent}</span>
                    <span>Delivered: {counts.delivered}</span>
                    <span>SMS: {counts.deliveredBySms}</span>
                    <span>Failed: {counts.failed}</span>
                    <span>Tapped OK: {counts.tappedOk}</span>
                  </div>
              </div>
            );
          })}
        </div>
      )}

      {broadcastsQuery.hasNextPage && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => void broadcastsQuery.fetchNextPage()}
            disabled={broadcastsQuery.isFetchingNextPage}
          >
            {broadcastsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
      </section>
    </div>
  );
}
