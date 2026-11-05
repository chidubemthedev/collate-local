"use client";

import { Suspense, use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ApiClientError, apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/hooks/use-auth";
import type { BroadcastDelivery, BroadcastDetail } from "@/types/api";
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toTitleCase } from "@/components/candidates/candidates-filters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActiveFilterChips, type ActiveTableFilter } from "@/components/ui/active-filter-chips";
import { Skeleton, StatCardSkeleton, TableSkeleton } from "@/components/ui/skeleton";

type DeliveryStatusFilter = "all" | BroadcastDelivery["status"];
type GroupFilter = "all" | "candidate" | "official_agent" | "extra_agent";

const GROUP_OPTIONS: Array<{ value: GroupFilter; label: string }> = [
  { value: "all", label: "Everyone" },
  { value: "candidate", label: "Candidates" },
  { value: "official_agent", label: "Official agents" },
  { value: "extra_agent", label: "Extra agents" },
];

const PAGE_SIZE = 10;

const STATUS_PILL: Record<BroadcastDelivery["status"], { label: string; className: string }> = {
  tapped_ok: { label: "Tapped OK", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  delivered: { label: "Delivered", className: "bg-muted text-foreground" },
  delivered_by_sms: { label: "Delivered by SMS", className: "bg-muted text-foreground" },
  sent: { label: "No report yet", className: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  failed: { label: "Failed", className: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" },
};

/** Group pill: NDC office for candidates, otherwise the agent type. */
function groupPill(recipient: BroadcastDelivery["recipient"]): { label: string; className: string } | null {
  if (recipient.kind === "candidate" && recipient.officeName) {
    return {
      label: `NDC · ${recipient.officeName}${recipient.isRunningMate ? " (running mate)" : ""}`,
      className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    };
  }
  if (recipient.kind === "official_agent") {
    return {
      label: "Official agent",
      className: "border border-dashed border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    };
  }
  if (recipient.kind === "extra_agent") {
    return {
      label: recipient.ownerName ? `Extra · ${recipient.ownerName}` : "Extra agent",
      className: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
    };
  }
  return null;
}

/** Area: "04 · Anambra North" for a seat, "04-17-01-002 · All Saints Primary School II" for a unit. */
function areaLabel(recipient: BroadcastDelivery["recipient"]): string {
  if (recipient.kind === "candidate" && recipient.seatName) {
    const seat = toTitleCase(recipient.seatName);
    return recipient.stateCode ? `${recipient.stateCode} · ${seat}` : seat;
  }
  if (recipient.pollingUnitCode) {
    return recipient.pollingUnitName
      ? `${recipient.pollingUnitCode} · ${toTitleCase(recipient.pollingUnitName)}`
      : recipient.pollingUnitCode;
  }
  return "—";
}

/** The latest thing that happened to the delivery. */
function eventTime(delivery: BroadcastDelivery): string {
  const value = delivery.tappedOkAt ?? delivery.deliveredAt ?? delivery.failedAt ?? delivery.sentAt ?? delivery.createdAt;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

// Unfilled agent slots are named after their unit, e.g. "Agent – 04-17-03-012 /1" (PRD).
const PLACEHOLDER_NAME = /^(official\s+)?agent\s+[–-]/i;

const STATUS_OPTIONS: Array<{ value: DeliveryStatusFilter; label: string }> = [
  { value: "all", label: "Any status" },
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent, no report yet" },
  { value: "delivered", label: "Delivered" },
  { value: "delivered_by_sms", label: "Delivered by SMS" },
  { value: "tapped_ok", label: "Tapped OK" },
  { value: "failed", label: "Failed" },
];

const LABEL_CLASS =
  "flex items-center gap-1.5 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground";
const TRIGGER_CLASS = "h-8 w-full bg-background text-xs data-[disabled]:bg-muted data-[disabled]:opacity-70";

const KPI_CARD = "flex h-full flex-col rounded-xl border border-border/60 bg-card p-4";
const KPI_LABEL = "text-[11px] font-medium text-foreground/80";
const KPI_VALUE = "mt-3 text-xl md:text-2xl font-bold tracking-tight tabular-nums";
const KPI_NOTE = "mt-3 text-[10px] leading-snug text-muted-foreground";

const TABLE_COLUMNS = ["Name", "Group", "Area", "Time", "Status", "Source"];

function formatStatus(status: string): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status.replaceAll("_", " ");
}

/** "today 09:14", "yesterday 09:14" or "25 Oct 09:14". */
function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return `today ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `yesterday ${time}`;
  return `${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${time}`;
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function SkeletonHeading({ className = "h-7 w-72" }: { className?: string }) {
  return <Skeleton className={className} />;
}

function BroadcastReport({ id }: { id: string }) {
  const [status, setStatus] = useState<DeliveryStatusFilter>("all");
  const [group, setGroup] = useState<GroupFilter>("all");
  const [search, setSearch] = useState("");
  const [pageState, setPageState] = useState({ key: "", page: 1 });
  const { data: session } = useSession();

  const detailQuery = useQuery({
    queryKey: ["broadcast", id],
    queryFn: async () => (await apiClient.get<BroadcastDetail>(`/api/broadcasts/${id}`)).data,
  });
  const deliveriesQuery = useInfiniteQuery({
    queryKey: ["broadcast", id, "deliveries"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => apiClient.get<BroadcastDelivery[]>(
      `/api/broadcasts/${id}/deliveries`,
      { limit: 100, cursor: pageParam },
    ),
    getNextPageParam: (lastPage) => lastPage.meta?.nextCursor ?? undefined,
    enabled: detailQuery.isSuccess,
  });

  const pages = deliveriesQuery.data?.pages;
  const deliveries = useMemo(() => pages?.flatMap((page) => page.data) ?? [], [pages]);
  // Search, group and status apply to the delivery records loaded so far.
  const filteredDeliveries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return deliveries.filter((delivery) => {
      if (status !== "all" && delivery.status !== status) return false;
      if (group !== "all" && delivery.recipient?.kind !== group) return false;
      if (!query) return true;
      return [
        delivery.fullName,
        delivery.maskedPhone ?? "",
        delivery.recipient?.pollingUnitCode ?? "",
        delivery.recipient?.seatName ?? "",
      ].some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [deliveries, search, status, group]);

  // Pagination: back to page 1 when a filter changes, not when more rows load.
  const listKey = `${search.trim()}|${status}|${group}`;
  const currentPage = pageState.key === listKey ? pageState.page : 1;
  const setPage = (page: number) => setPageState({ key: listKey, page });
  const totalItems = filteredDeliveries.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageRows = filteredDeliveries.slice(startIndex, startIndex + PAGE_SIZE);
  const hasMore = Boolean(deliveriesQuery.hasNextPage);

  // Reaching the last loaded page pulls in the next batch from the server.
  const { fetchNextPage, isFetchingNextPage } = deliveriesQuery;
  const loadMore = useCallback(() => void fetchNextPage(), [fetchNextPage]);
  const onLastLoadedPage = safePage === totalPages;
  useEffect(() => {
    if (onLastLoadedPage && hasMore && !isFetchingNextPage) loadMore();
  }, [onLastLoadedPage, hasMore, isFetchingNextPage, loadMore]);
  const deliveriesRefreshing =
    deliveriesQuery.isFetching && !isFetchingNextPage && !deliveriesQuery.isPending;

  if (detailQuery.isPending) {
    return (
      <div aria-busy="true" className="mx-auto max-w-7xl space-y-5">
        <div className="space-y-2">
          <SkeletonHeading />
          <SkeletonHeading className="h-4 w-96" />
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
        <StatCardSkeleton count={5} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" />
        <TableSkeleton columns={TABLE_COLUMNS} />
      </div>
    );
  }
  if (detailQuery.isError) {
    const notFound = detailQuery.error instanceof ApiClientError &&
      (detailQuery.error.status === 404 || detailQuery.error.code === "validation_failed");
    return (
      <div className="mx-auto mt-12 max-w-xl space-y-3 rounded-lg border p-8 text-center">
        <AlertCircle className="mx-auto h-6 w-6 text-destructive" />
        <h1 className="font-semibold">{notFound ? "Broadcast not found" : "Could not load broadcast"}</h1>
        <p className="text-sm text-muted-foreground">
          {notFound ? "This broadcast does not exist or you do not have access to it." : detailQuery.error.message}
        </p>
        {!notFound && (
          <Button variant="outline" onClick={() => void detailQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />Retry
          </Button>
        )}
        <div><Link href="/broadcasts" className="text-sm text-primary underline-offset-4 hover:underline">Back to broadcasts</Link></div>
      </div>
    );
  }

  const broadcast = detailQuery.data;
  const counts = broadcast.deliveryCounts;
  const total = counts.pending + counts.sent + counts.delivered + counts.deliveredBySms + counts.failed + counts.tappedOk;
  // A tapped OK was delivered first, so it counts as delivered too.
  const delivered = counts.delivered + counts.deliveredBySms + counts.tappedOk;
  // Pending includes messages handed over with no delivery report back yet.
  const pending = counts.pending + counts.sent;
  const sender = session?.person?.id && broadcast.sender.id === session.person.id
    ? "you"
    : broadcast.sender.displayName;
  const subtitle = [
    `Sent by ${sender}`,
    formatWhen(broadcast.scheduledSendAt ?? broadcast.createdAt),
    broadcast.audienceSummary.join(", "),
    "Telegram with SMS fallback",
  ].filter(Boolean).join(" · ");

  const activeFilters: ActiveTableFilter[] = [
    ...(search.trim() ? [{ id: "search", label: `Search: ${search.trim()}`, onRemove: () => setSearch("") }] : []),
    ...(group !== "all"
      ? [{
          id: "group",
          label: `Group: ${GROUP_OPTIONS.find((option) => option.value === group)?.label ?? group}`,
          onRemove: () => setGroup("all"),
        }]
      : []),
    ...(status !== "all" ? [{ id: "status", label: `Status: ${formatStatus(status)}`, onRemove: () => setStatus("all") }] : []),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="space-y-3">
        <Link
          href="/broadcasts"
          className="-ml-2 inline-flex h-7 items-center rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Broadcasts
        </Link>
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            {broadcast.title || "Broadcast"}
          </h1>
          <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {/* Neither action has an API yet. */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled title="Not available yet" className="h-8 px-3 text-xs">
            Resend failed by SMS
          </Button>
          <Button
            disabled
            title="Not available yet"
            className="h-8 bg-foreground px-3 text-xs text-background hover:bg-foreground/90"
          >
            Remind those not OK yet
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0 space-y-1.5">
            <label className={LABEL_CLASS}>Search</label>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or INEC code"
              className="h-8 w-full bg-background text-xs"
            />
          </div>

          <div className="min-w-0 space-y-1.5">
            <label className={LABEL_CLASS}>Group</label>
            <Select
              value={group}
              onValueChange={(val) => {
                if (val) setGroup(val as GroupFilter);
              }}
            >
              <SelectTrigger className={TRIGGER_CLASS}>
                <SelectValue placeholder="Everyone">
                  {(val) => GROUP_OPTIONS.find((option) => option.value === val)?.label ?? "Everyone"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {GROUP_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Delivery records carry no ward yet. */}
          <div className="min-w-0 space-y-1.5" title="Not available yet">
            <label className={LABEL_CLASS}>Ward</label>
            <Select value="all" disabled>
              <SelectTrigger className={TRIGGER_CLASS}>
                <SelectValue placeholder="All wards">{() => "All wards"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All wards</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 space-y-1.5">
            <label className={LABEL_CLASS}>Delivery status</label>
            <Select
              value={status}
              onValueChange={(val) => {
                if (val) setStatus(val as DeliveryStatusFilter);
              }}
            >
              <SelectTrigger className={TRIGGER_CLASS}>
                <SelectValue placeholder="Any status">{(val) => formatStatus((val as string) ?? "all")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ActiveFilterChips
          filters={activeFilters}
          onClear={() => {
            setSearch("");
            setStatus("all");
            setGroup("all");
          }}
        />
      </div>

      {/* Delivery cards */}
      <div
        aria-busy={detailQuery.isFetching}
        className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 transition-opacity ${
          detailQuery.isFetching ? "opacity-60" : ""
        }`}
      >
        <div className={KPI_CARD}>
          <div className={KPI_LABEL}>Sent</div>
          <div className={`${KPI_VALUE} text-foreground`}>{total.toLocaleString()}</div>
          <div className={KPI_NOTE}>people in the audience</div>
        </div>
        <div className={KPI_CARD}>
          <div className={KPI_LABEL}>Delivered</div>
          <div className={`${KPI_VALUE} text-foreground`}>{delivered.toLocaleString()}</div>
          <div className={KPI_NOTE}>
            {percent(delivered, total)}%, {counts.deliveredBySms.toLocaleString()} by SMS
          </div>
        </div>
        <div className={KPI_CARD}>
          <div className={KPI_LABEL}>Tapped OK</div>
          <div className={`${KPI_VALUE} text-emerald-600 dark:text-emerald-400`}>
            {counts.tappedOk.toLocaleString()}
          </div>
          <div className={KPI_NOTE}>{percent(counts.tappedOk, total)}% of sent</div>
        </div>
        <div className={KPI_CARD}>
          <div className={KPI_LABEL}>Pending</div>
          <div className={`${KPI_VALUE} text-yellow-700 dark:text-yellow-500`}>{pending.toLocaleString()}</div>
          <div className={KPI_NOTE}>no report yet</div>
        </div>
        <div className={KPI_CARD}>
          <div className={KPI_LABEL}>Failed</div>
          <div className={`${KPI_VALUE} text-red-700 dark:text-red-400`}>{counts.failed.toLocaleString()}</div>
          <div className={KPI_NOTE}>Telegram and SMS</div>
        </div>
      </div>

      {/* Delivery records */}
      <section
        aria-busy={deliveriesRefreshing}
        className="relative min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card"
      >
        {deliveriesQuery.isPending ? (
          <div className="p-3 sm:p-4">
            <TableSkeleton columns={TABLE_COLUMNS} />
          </div>
        ) : deliveriesQuery.isError && deliveries.length === 0 ? (
          <div className="space-y-3 p-8 text-center">
            <AlertCircle className="mx-auto h-6 w-6 text-destructive" />
            <p className="text-sm text-destructive">{deliveriesQuery.error.message}</p>
            <Button variant="outline" size="sm" onClick={() => void deliveriesQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />Retry
            </Button>
          </div>
        ) : (
          <>
            <div className={`overflow-x-auto transition-opacity ${deliveriesRefreshing ? "pointer-events-none opacity-40" : ""}`}>
              <Table>
                <TableHeader className="text-[11px]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[160px] pl-4 font-semibold text-foreground">Name</TableHead>
                    <TableHead className="font-semibold text-foreground">Group</TableHead>
                    <TableHead className="min-w-[220px] font-semibold text-foreground">Area</TableHead>
                    <TableHead
                      className="font-semibold text-foreground whitespace-nowrap"
                      title="When the latest update happened: tapped OK, delivered, failed or sent"
                    >
                      Time *
                    </TableHead>
                    <TableHead
                      className="font-semibold text-foreground whitespace-nowrap"
                      title="Where this message is now"
                    >
                      Status *
                    </TableHead>
                    <TableHead className="pr-4 font-semibold text-foreground">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {pageRows.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                        {hasMore && isFetchingNextPage ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Loading recipients…
                          </span>
                        ) : deliveries.length === 0 ? (
                          "No one has been sent this broadcast yet."
                        ) : (
                          "No recipients match these filters."
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((delivery) => {
                      const recipient = delivery.recipient;
                      const pill = recipient ? groupPill(recipient) : null;
                      const statusPill = STATUS_PILL[delivery.status];
                      const isPlaceholder = PLACEHOLDER_NAME.test(delivery.fullName);

                      return (
                        <TableRow key={delivery.id} className="hover:bg-muted/30">
                          <TableCell className="pl-4">
                            {isPlaceholder ? (
                              <span className="italic text-muted-foreground">{delivery.fullName}</span>
                            ) : (
                              <span className="font-semibold text-foreground">{toTitleCase(delivery.fullName)}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {pill ? (
                              <span className={`inline-flex max-w-[180px] rounded-md px-2 py-0.5 text-[11px] font-medium leading-snug ${pill.className}`}>
                                {pill.label}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-foreground">
                            {recipient ? areaLabel(recipient) : "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums text-foreground">
                            {eventTime(delivery)}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusPill.className}`}>
                              {statusPill.label}
                            </span>
                          </TableCell>
                          <TableCell className="pr-4 whitespace-nowrap text-muted-foreground">
                            {recipient?.source ?? "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {deliveriesRefreshing && (
              <div role="status" className="absolute inset-0 z-10 flex items-center justify-center">
                <span className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Loading recipients…
                </span>
              </div>
            )}

            {totalItems > 0 && (
              <div className="flex flex-col items-center justify-between gap-2.5 border-t border-border/60 px-4 py-3 text-xs sm:flex-row">
                <div className="text-muted-foreground">
                  Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, totalItems)} of{" "}
                  {totalItems.toLocaleString()}
                  {hasMore ? "+" : ""} recipient{totalItems === 1 ? "" : "s"}
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

function ReportPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <BroadcastReport id={id} />;
}

export default function LiveBroadcastReport({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div aria-busy="true" className="mx-auto max-w-7xl space-y-5 p-4"><SkeletonHeading /><StatCardSkeleton count={5} /><TableSkeleton columns={TABLE_COLUMNS} /></div>}>
      <ReportPageContent params={params} />
    </Suspense>
  );
}
