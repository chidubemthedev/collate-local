"use client";

import { Suspense, use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ApiClientError, apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/hooks/use-auth";
import type { BroadcastDelivery, BroadcastDetail } from "@/types/api";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { toTitleCase } from "@/components/candidates/candidates-filters";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableToolbar, type ActiveTableFilter } from "@/components/ui/table-toolbar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WF, PageHeader, StatTile, LoadingBox, CenterSpinner, EmptyBox, FILTER_GRID } from "@/components/ui/wf";

type DeliveryStatusFilter = "all" | BroadcastDelivery["status"];
type GroupFilter = "all" | "candidate" | "official_agent" | "extra_agent";

const GROUP_OPTIONS: Array<{ value: GroupFilter; label: string }> = [
  { value: "all", label: "Everyone" },
  { value: "candidate", label: "Candidates" },
  { value: "official_agent", label: "Official agents" },
  { value: "extra_agent", label: "Extra agents" },
];

const PAGE_SIZE = 25;

const PILL = "inline-block rounded-full px-[9px] py-[3px] text-[12px] font-semibold whitespace-nowrap";

const STATUS_PILL: Record<BroadcastDelivery["status"], { label: string; className: string }> = {
  tapped_ok: { label: "Tapped OK", className: "bg-[#E8F5EE] text-[#1E8A55]" },
  delivered: { label: "Delivered", className: "bg-[#F4F4F5] text-[#0A0A0A]" },
  delivered_by_sms: { label: "Delivered by SMS", className: "bg-[#E0F2FE] text-[#075985]" },
  sent: { label: "No report yet", className: "bg-[#FEF3C7] text-[#92400E]" },
  pending: { label: "Pending", className: "bg-[#FEF3C7] text-[#92400E]" },
  failed: { label: "Failed", className: "bg-[#FDECEC] text-[#B42318]" },
};

const BADGE = "inline-block max-w-[220px] rounded-[4px] px-1.5 py-px text-[12px] font-semibold leading-snug";

/** Group badge: NDC office for candidates, otherwise the agent type (dashed). */
function groupPill(recipient: BroadcastDelivery["recipient"]): { label: string; className: string } | null {
  if (recipient.kind === "candidate" && recipient.officeName) {
    return {
      label: `NDC · ${recipient.officeName}${recipient.isRunningMate ? " (running mate)" : ""}`,
      className: "bg-[#E8F5EE] text-[#1E8A55]",
    };
  }
  if (recipient.kind === "official_agent") {
    return {
      label: "Official agent",
      className: "border border-dashed border-[#1E8A55] bg-[#E8F5EE] text-[#1E8A55]",
    };
  }
  if (recipient.kind === "extra_agent") {
    return {
      label: recipient.ownerName ? `Extra · ${recipient.ownerName}` : "Extra agent",
      className: "border border-dashed border-[#6D28D9] bg-[#F3E8FF] text-[#6D28D9]",
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

const LABEL_CLASS = `${WF.label} flex items-center gap-1.5 truncate`;
const TRIGGER_CLASS = "w-full";

const TH = "sticky top-0 z-[1] border-b border-[#E5E5E5] bg-white px-3.5 py-2.5 text-left text-[12px] font-bold whitespace-nowrap text-[#525252]";
const TD = "px-3.5 py-2.5";

const BACK_LINK =
  "inline-flex min-h-10 items-center self-start text-[14px] font-semibold text-[#1F5FBF] no-underline hover:text-[#0A0A0A]";

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
      <div className="flex flex-col gap-4">
        <Link href="/broadcasts" className={BACK_LINK}>
          ← All broadcasts
        </Link>
        <LoadingBox>Loading the report…</LoadingBox>
      </div>
    );
  }
  if (detailQuery.isError) {
    const notFound = detailQuery.error instanceof ApiClientError &&
      (detailQuery.error.status === 404 || detailQuery.error.code === "validation_failed");
    return (
      <div className={`${WF.card} mx-auto mt-12 max-w-xl space-y-3 p-8 text-center`}>
        <AlertCircle className="mx-auto h-6 w-6 text-[#B42318]" />
        <h1 className="m-0 text-[15px] font-semibold">{notFound ? "Broadcast not found" : "Could not load broadcast"}</h1>
        <p className="m-0 text-[13px] text-[#737373]">
          {notFound ? "This broadcast does not exist or you do not have access to it." : detailQuery.error.message}
        </p>
        {!notFound && (
          <button type="button" className={WF.btnOutline} onClick={() => void detailQuery.refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        )}
        <div>
          <Link href="/broadcasts" className={BACK_LINK}>
            ← All broadcasts
          </Link>
        </div>
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

  // Neither action has an API yet.
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

  const nameCell = (delivery: BroadcastDelivery) =>
    PLACEHOLDER_NAME.test(delivery.fullName) ? (
      <span className="text-[#6B4A2B] italic">{delivery.fullName}</span>
    ) : (
      <span className="font-semibold">{toTitleCase(delivery.fullName)}</span>
    );

  return (
    <div className="flex w-full min-w-0 flex-col gap-3.5 text-[#0A0A0A] sm:gap-4">
      <Link href="/broadcasts" className={BACK_LINK}>
        ← All broadcasts
      </Link>

      <PageHeader
        title={broadcast.title || "Broadcast"}
        subtitle={subtitle}
        actions={
          <>
            {notYet("Resend failed by SMS")}
            {notYet("Remind those not OK yet", true)}
          </>
        }
      />

      <section aria-label="Filters" className={`${WF.card} p-3 sm:p-4`}>
        <TableToolbar
          activeFilters={activeFilters}
          onClear={() => {
            setSearch("");
            setStatus("all");
            setGroup("all");
          }}
          summary={activeFilters.length ? "Filtered" : "None set"}
        >
          <div className={FILTER_GRID}>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="report-search" className={LABEL_CLASS}>
                Search
              </label>
              <Input
                id="report-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name or INEC code"
              />
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <label className={LABEL_CLASS}>Group</label>
              <Select
                value={group}
                onValueChange={(val) => {
                  if (val) setGroup(val as GroupFilter);
                }}
              >
                <SelectTrigger className={TRIGGER_CLASS}>
                  <SelectValue>{(val) => GROUP_OPTIONS.find((option) => option.value === val)?.label ?? "Everyone"}</SelectValue>
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
            <div className="flex min-w-0 flex-col gap-1" title="Not available yet">
              <label className={LABEL_CLASS}>Ward</label>
              <Select value="all" disabled>
                <SelectTrigger className={TRIGGER_CLASS}>
                  <SelectValue>{() => "Select"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All wards</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <label className={LABEL_CLASS}>Delivery status</label>
              <Select
                value={status}
                onValueChange={(val) => {
                  if (val) setStatus(val as DeliveryStatusFilter);
                }}
              >
                <SelectTrigger className={TRIGGER_CLASS}>
                  <SelectValue>{(val) => formatStatus((val as string) ?? "all")}</SelectValue>
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
        </TableToolbar>
      </section>

      <section
        aria-label="Delivery summary"
        aria-busy={detailQuery.isFetching}
        className={`grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2 transition-opacity sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] sm:gap-3 ${
          detailQuery.isFetching ? "opacity-60" : ""
        }`}
      >
        <StatTile label="Sent" value={total.toLocaleString()} note="people in the audience" />
        <StatTile
          label="Delivered"
          value={delivered.toLocaleString()}
          note={`${percent(delivered, total)}%, ${counts.deliveredBySms.toLocaleString()} by SMS`}
        />
        <StatTile
          label="Tapped OK"
          value={counts.tappedOk.toLocaleString()}
          color="#1E8A55"
          note={`${percent(counts.tappedOk, total)}% of sent`}
        />
        <StatTile label="Pending" value={pending.toLocaleString()} color="#7A5A00" note="no report yet" />
        <StatTile label="Failed" value={counts.failed.toLocaleString()} color="#9B1C1C" note="Telegram and SMS" />
      </section>

      {deliveriesQuery.isPending ? (
        <LoadingBox>Loading recipients…</LoadingBox>
      ) : deliveriesQuery.isError && deliveries.length === 0 ? (
        <div className={`${WF.card} space-y-3 p-8 text-center`}>
          <AlertCircle className="mx-auto h-6 w-6 text-[#B42318]" />
          <p className="m-0 text-[13px] text-[#B42318]">{deliveriesQuery.error.message}</p>
          <button type="button" className={WF.btnOutline} onClick={() => void deliveriesQuery.refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      ) : pageRows.length === 0 ? (
        hasMore && isFetchingNextPage ? (
          <LoadingBox>Loading recipients…</LoadingBox>
        ) : (
          <EmptyBox>
            {deliveries.length === 0 ? "No one has been sent this broadcast yet." : "Nobody matches these filters."}
          </EmptyBox>
        )
      ) : (
        <section aria-busy={deliveriesRefreshing} className="relative min-w-0">
          <CenterSpinner show={deliveriesRefreshing} />
          <div className={`transition-opacity ${deliveriesRefreshing ? "pointer-events-none opacity-40" : ""}`}>
            <div className={`${WF.card} hidden max-h-[640px] overflow-auto md:block`}>
              <table className={WF.table}>
                <thead>
                  <tr>
                    <th scope="col" className={TH}>
                      Name
                    </th>
                    <th scope="col" className={TH}>
                      Group
                    </th>
                    <th scope="col" className={TH}>
                      Area
                    </th>
                    <th scope="col" className={TH} title="When the latest update happened: tapped OK, delivered, failed or sent">
                      Time *
                    </th>
                    <th scope="col" className={TH} title="Where this message is now">
                      Status *
                    </th>
                    <th scope="col" className={TH}>
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((delivery) => {
                    const recipient = delivery.recipient;
                    const pill = recipient ? groupPill(recipient) : null;
                    const statusPill = STATUS_PILL[delivery.status];
                    return (
                      <tr key={delivery.id} className={WF.tr}>
                        <td className={TD}>{nameCell(delivery)}</td>
                        <td className={TD}>
                          {pill ? (
                            <span className={`${BADGE} ${pill.className}`}>{pill.label}</span>
                          ) : (
                            <span className="text-[#A3A3A3]">—</span>
                          )}
                        </td>
                        <td className={`${TD} tabular-nums`}>{recipient ? areaLabel(recipient) : "—"}</td>
                        <td className={`${TD} whitespace-nowrap tabular-nums`}>{eventTime(delivery)}</td>
                        <td className={`${TD} whitespace-nowrap`}>
                          <span className={`${PILL} ${statusPill.className}`}>{statusPill.label}</span>
                        </td>
                        <td className={`${TD} text-[12px] whitespace-nowrap text-[#737373]`}>{recipient?.source ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 md:hidden">
              {pageRows.map((delivery) => {
                const recipient = delivery.recipient;
                const pill = recipient ? groupPill(recipient) : null;
                const statusPill = STATUS_PILL[delivery.status];
                return (
                  <div key={delivery.id} className="flex flex-col gap-1.5 rounded-[10px] border border-[#E5E5E5] bg-white px-3.5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[15px]">{nameCell(delivery)}</span>
                      <span className={`${PILL} ${statusPill.className}`}>{statusPill.label}</span>
                    </div>
                    <span className="text-[13px] text-[#525252]">
                      {pill ? <span className={`${BADGE} ${pill.className}`}>{pill.label}</span> : null}
                      {recipient ? ` · ${areaLabel(recipient)}` : ""}
                    </span>
                    <span className="text-[13px] text-[#6B4A2B] tabular-nums">{eventTime(delivery)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {totalItems > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12px] text-[#737373]">
            Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, totalItems)} of {totalItems.toLocaleString()}
            {hasMore ? "+" : ""} recipient{totalItems === 1 ? "" : "s"}
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

function ReportPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <BroadcastReport id={id} />;
}

export default function LiveBroadcastReport({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingBox>Loading the report…</LoadingBox>}>
      <ReportPageContent params={params} />
    </Suspense>
  );
}
