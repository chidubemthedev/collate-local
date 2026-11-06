"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, Plus, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/hooks/use-auth";
import type { BroadcastListItem, BroadcastStatus } from "@/types/api";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableToolbar } from "@/components/ui/table-toolbar";
import {
  WF,
  PageHeader,
  Pill,
  StatTile,
  CountTabs,
  CenterSpinner,
  LoadingBox,
  EmptyBox,
  Field,
  FILTER_GRID,
  type Tone,
} from "@/components/ui/wf";

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

const STATUS_PILL: Record<BroadcastStatus, { label: string; tone: Tone }> = {
  completed: { label: "Sent", tone: "green" },
  sending: { label: "Sending", tone: "sky" },
  scheduled: { label: "Scheduled", tone: "blue" },
  draft: { label: "Draft", tone: "grey" },
  failed: { label: "Failed", tone: "red" },
  cancelled: { label: "Cancelled", tone: "grey" },
};

const PAGE_SIZE = 25;

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
  const [sender, setSender] = useState("all");
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

  // "Sent by" choices: everyone who sent one of the broadcasts loaded so far.
  const senders = useMemo(() => {
    const byId = new Map<string, string>();
    for (const broadcast of broadcasts) byId.set(String(broadcast.sender.id), broadcast.sender.displayName);
    return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((x, y) => x.name.localeCompare(y.name));
  }, [broadcasts]);
  const bySender = useMemo(
    () => (sender === "all" ? broadcasts : broadcasts.filter((b) => String(b.sender.id) === sender)),
    [broadcasts, sender],
  );

  const tabCounts = useMemo(() => {
    const counts: Record<BroadcastTab, number> = { all: bySender.length, sent: 0, scheduled: 0, draft: 0 };
    for (const broadcast of bySender) {
      const owner = tabOf(broadcast.status);
      if (owner) counts[owner] += 1;
    }
    return counts;
  }, [bySender]);

  const filteredBroadcasts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return bySender.filter((broadcast) => {
      if (tab !== "all" && tabOf(broadcast.status) !== tab) return false;
      if (!query) return true;
      return [
        broadcast.title,
        broadcast.messageText,
        broadcast.sender.displayName,
        ...broadcast.audienceSummary,
      ].some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [bySender, search, tab]);

  // Pagination: back to page 1 when the tab or search changes, not when more rows load.
  const listKey = `${tab}|${sender}|${search.trim()}`;
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

  const senderName = (id: string) => senders.find((item) => item.id === id)?.name ?? "Selected";
  const activeFilters = [
    ...(search.trim() ? [{ id: "search", label: `Search: ${search.trim()}`, onRemove: () => setSearch("") }] : []),
    ...(sender !== "all" ? [{ id: "sender", label: `Sent by: ${senderName(sender)}`, onRemove: () => setSender("all") }] : []),
  ];

  const rowView = (broadcast: BroadcastListItem) => {
    const counts = broadcast.deliveryCounts;
    const total = deliveryTotal(broadcast);
    const delivered = deliveredCount(broadcast);
    const waiting = counts.pending + counts.sent;
    const notYetSent = broadcast.status === "draft" || broadcast.status === "scheduled";
    const hasBar = !notYetSent && total > 0;
    const by = myPersonId && broadcast.sender.id === myPersonId ? "you" : broadcast.sender.displayName;
    return {
      pill: STATUS_PILL[broadcast.status],
      hasBar,
      total,
      audience: broadcast.audienceSummary.join(", "),
      by,
      delT: hasBar ? `${percent(delivered, total)}%` : "—",
      okT: hasBar ? `${percent(counts.tappedOk, total)}%` : "—",
      failT: `${counts.failed.toLocaleString()} failed · ${waiting.toLocaleString()} pending`,
      okPct: percent(counts.tappedOk, total),
      delPct: percent(delivered - counts.tappedOk, total),
      failPct: percent(counts.failed, total),
      when: formatDate(broadcast.scheduledSendAt ?? broadcast.createdAt),
      href: `/broadcasts/${broadcast.id}`,
    };
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 text-[#0A0A0A] sm:gap-4">
      <PageHeader
        title="Broadcasts"
        subtitle="Every message sent down the tree, with its delivery report"
        actions={
          <Link href="/broadcasts/new" className={WF.btnDark}>
            <Plus className="h-3.5 w-3.5" />
            New broadcast
          </Link>
        }
      />

      {broadcastsQuery.isPending ? (
        <LoadingBox>Loading broadcasts…</LoadingBox>
      ) : (
        <section
          aria-label="Summary"
          aria-busy={isRefreshing}
          className={`grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2 transition-opacity sm:grid-cols-[repeat(auto-fit,minmax(190px,1fr))] sm:gap-3 ${
            isRefreshing ? "opacity-60" : ""
          }`}
        >
          <StatTile label="Broadcasts" value={kpis.broadcasts.toLocaleString()} note={`${kpis.sentBroadcasts.toLocaleString()} sent`} />
          <StatTile label="Messages sent" value={kpis.messages.toLocaleString()} note="in this list" />
          <StatTile label="Delivered" value={`${kpis.deliveredPct}%`} note={`${kpis.delivered.toLocaleString()} people`} />
          <StatTile label="Tapped OK" value={`${kpis.tappedOkPct}%`} note={`${kpis.tappedOk.toLocaleString()} people`} />
        </section>
      )}

      <CountTabs<BroadcastTab>
        label="Status"
        value={tab}
        onChange={setTab}
        tabs={TABS.map((item) => ({ id: item.id, label: item.label, count: tabCounts[item.id] }))}
      />

      <section aria-label="Filters" className={`${WF.card} p-3 sm:px-4 sm:py-3.5`}>
        <TableToolbar
          activeFilters={activeFilters}
          onClear={() => {
            setSearch("");
            setSender("all");
          }}
        >
          <div className={FILTER_GRID}>
            <Field label="Search" htmlFor="bl-search">
              <Input
                id="bl-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Title, message, audience or sender"
              />
            </Field>
            <Field label="Sent by">
              <Select value={sender} onValueChange={(value) => setSender(value ? String(value) : "all")}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(value) => (!value || value === "all" ? "Anyone" : senderName(String(value)))}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Anyone</SelectItem>
                  {senders.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {myPersonId && item.id === String(myPersonId) ? `${item.name} (you)` : item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </TableToolbar>
      </section>

      {broadcastsQuery.isPending ? null : broadcastsQuery.isError && broadcasts.length === 0 ? (
        <div className={`${WF.card} space-y-3 p-8 text-center`}>
          <AlertCircle className="mx-auto h-6 w-6 text-[#B42318]" />
          <p className="text-[13px] text-[#B42318]">{broadcastsQuery.error.message}</p>
          <button type="button" className={WF.btnOutline} onClick={() => void broadcastsQuery.refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      ) : pageRows.length === 0 ? (
        hasMore && isFetchingNextPage ? (
          <LoadingBox>Loading broadcasts…</LoadingBox>
        ) : (
          <EmptyBox>{broadcasts.length === 0 ? "No broadcasts yet." : "No broadcasts match these filters."}</EmptyBox>
        )
      ) : (
        <section aria-busy={isRefreshing} className="relative min-w-0">
          <CenterSpinner show={isRefreshing} />
          <div className={`transition-opacity ${isRefreshing ? "pointer-events-none opacity-40" : ""}`}>
            <div className={`${WF.card} hidden overflow-x-auto md:block`}>
              <table className={`${WF.table} min-w-[900px]`}>
                <thead>
                  <tr>
                    <th scope="col" className={`${WF.th} pl-4`}>
                      Broadcast
                    </th>
                    <th scope="col" className={WF.th}>
                      Status
                    </th>
                    <th scope="col" className={WF.th} title="Everyone the broadcast went to">
                      Audience *
                    </th>
                    <th scope="col" className={WF.th} title="Delivered by Telegram or SMS, out of everyone in the audience">
                      Delivered *
                    </th>
                    <th scope="col" className={WF.th} title="Tapped the OK button, out of everyone in the audience">
                      Tapped OK *
                    </th>
                    <th scope="col" className={WF.th}>
                      Date
                    </th>
                    <th scope="col" className={`${WF.th} pr-4 text-right`}>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((broadcast) => {
                    const r = rowView(broadcast);
                    return (
                      <tr key={broadcast.id} className={`${WF.tr} align-top`}>
                        <td className="max-w-[360px] py-3 pr-2 pl-4">
                          <span className="flex flex-col gap-[3px]">
                            <span className="font-semibold">{broadcast.title || "Broadcast"}</span>
                            <span className="truncate text-[12px] text-[#525252]" title={broadcast.messageText}>
                              {broadcast.messageText}
                            </span>
                            <span className="text-[11px] text-[#737373]">
                              {r.audience ? `${r.audience} · ` : ""}Sent by {r.by}
                            </span>
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <Pill tone={r.pill.tone}>{r.pill.label}</Pill>
                        </td>
                        <td className="px-2 py-3 tabular-nums">
                          <span className="font-semibold">
                            {r.total.toLocaleString()} {r.total === 1 ? "person" : "people"}
                          </span>
                        </td>
                        <td className="min-w-[110px] px-2 py-3">
                          {r.hasBar ? (
                            <span className="flex flex-col gap-[3px]">
                              <span className="font-semibold tabular-nums">{r.delT}</span>
                              <span aria-hidden="true" className="flex h-1 overflow-hidden rounded-[2px] bg-[#F0F0F0]">
                                <span className="bg-[#22A06B]" style={{ width: `${r.okPct}%` }} />
                                <span className="bg-[#A3A3A3]" style={{ width: `${r.delPct}%` }} />
                                <span className="bg-[#E5484D]" style={{ width: `${r.failPct}%` }} />
                              </span>
                              <span className="text-[11px] whitespace-nowrap text-[#737373]">{r.failT}</span>
                            </span>
                          ) : (
                            <span className="text-[#A3A3A3]">—</span>
                          )}
                        </td>
                        <td className="px-2 py-3 font-semibold tabular-nums text-[#1E8A55]">
                          {r.hasBar ? r.okT : <span className="font-normal text-[#A3A3A3]">—</span>}
                        </td>
                        <td className="px-2 py-3 whitespace-nowrap text-[#525252]">{r.when}</td>
                        <td className="py-3 pr-4 pl-2 text-right">
                          <Link href={r.href} className={`${WF.btnRow} whitespace-nowrap no-underline`}>
                            View report
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 md:hidden">
              {pageRows.map((broadcast) => {
                const r = rowView(broadcast);
                return (
                  <Link
                    key={broadcast.id}
                    href={r.href}
                    className={`${WF.card} flex flex-col gap-1.5 px-3.5 py-3 text-[#0A0A0A] no-underline hover:text-[#0A0A0A]`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-bold">{broadcast.title || "Broadcast"}</span>
                      <Pill tone={r.pill.tone}>{r.pill.label}</Pill>
                    </span>
                    <span className="text-[12px] text-[#525252]">{broadcast.messageText}</span>
                    <span className="text-[11px] text-[#737373]">
                      {r.audience ? `${r.audience} · ` : ""}
                      {r.when}
                    </span>
                    <span className="text-[12px] tabular-nums">
                      {r.total.toLocaleString()} people · {r.delT} delivered · {r.okT} OK
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {totalItems > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] text-[#737373]">
            Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, totalItems)} of {totalItems.toLocaleString()}
            {hasMore ? "+" : ""} broadcast{totalItems === 1 ? "" : "s"}
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
