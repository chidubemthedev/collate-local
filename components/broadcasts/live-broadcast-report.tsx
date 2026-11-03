"use client";

import { Suspense, use, useMemo, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ApiClientError, apiClient } from "@/lib/api/client";
import type { BroadcastDelivery, BroadcastDetail } from "@/types/api";
import { AlertCircle, ArrowLeft, Download, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type DeliveryStatusFilter = "all" | BroadcastDelivery["status"];

function formatStatus(status: string): string {
  return status.replaceAll("_", " ");
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function BroadcastReport({ id }: { id: string }) {
  const [status, setStatus] = useState<DeliveryStatusFilter>("all");
  const [search, setSearch] = useState("");
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
  const filteredDeliveries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return deliveries.filter((delivery) => {
      if (status !== "all" && delivery.status !== status) return false;
      return !query || delivery.fullName.toLocaleLowerCase().includes(query) ||
        (delivery.maskedPhone?.toLocaleLowerCase().includes(query) ?? false);
    });
  }, [deliveries, search, status]);

  const exportCsv = () => {
    const rows = [
      ["Recipient", "Masked phone", "Channel", "Status", "Sent at", "Delivered at", "Tapped OK at", "Failed at", "Created at"],
      ...filteredDeliveries.map((delivery) => [
        delivery.fullName,
        delivery.maskedPhone ?? "",
        delivery.channel,
        delivery.status,
        delivery.sentAt ?? "",
        delivery.deliveredAt ?? "",
        delivery.tappedOkAt ?? "",
        delivery.failedAt ?? "",
        delivery.createdAt,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `broadcast-${id}-deliveries.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (detailQuery.isPending) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading broadcast report…</p>;
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
  const statusOptions: DeliveryStatusFilter[] = [
    "all",
    "pending",
    "sent",
    "delivered",
    "delivered_by_sms",
    "failed",
    "tapped_ok",
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="space-y-3">
        <Link
          href="/broadcasts"
          className="-ml-3 inline-flex h-8 items-center rounded-lg px-2.5 text-sm hover:bg-muted"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />Broadcasts
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{broadcast.title || "Broadcast"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {broadcast.status.replaceAll("_", " ")} · Sent by {broadcast.sender.displayName}
            </p>
          </div>
          <Badge variant="outline">{broadcast.status.replaceAll("_", " ")}</Badge>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span>Audience: {broadcast.audienceSummary.join(", ")}</span>
          <span>Created: {formatDate(broadcast.createdAt)}</span>
          {broadcast.scheduledSendAt && <span>Scheduled: {formatDate(broadcast.scheduledSendAt)}</span>}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {([
          ["Pending", counts.pending],
          ["Sent", counts.sent],
          ["Delivered", counts.delivered],
          ["Delivered by SMS", counts.deliveredBySms],
          ["Failed", counts.failed],
          ["Tapped OK", counts.tappedOk],
        ] as const).map(([label, count]) => (
          <Card key={label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{count}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card><CardContent className="whitespace-pre-wrap p-4 text-sm">
        {broadcast.messageText}
      </CardContent></Card>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search recipient or masked phone"
          className="min-w-56 flex-1"
        />
        <select
          aria-label="Filter deliveries by status"
          value={status}
          onChange={(event) => setStatus(event.target.value as DeliveryStatusFilter)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option === "all" ? "All statuses" : formatStatus(option)}
            </option>
          ))}
        </select>
        <Button variant="outline" onClick={exportCsv} disabled={filteredDeliveries.length === 0}>
          <Download className="mr-2 h-4 w-4" />Export loaded rows
        </Button>
      </div>

      {deliveriesQuery.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading delivery records…</p>
      ) : deliveriesQuery.isError ? (
        <div className="space-y-3 rounded-lg border border-destructive/30 p-8 text-center">
          <p className="text-sm text-destructive">{deliveriesQuery.error.message}</p>
          <Button variant="outline" onClick={() => void deliveriesQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />Retry
          </Button>
        </div>
      ) : filteredDeliveries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No delivery records match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="p-3">Recipient</th>
                <th className="p-3">Masked phone</th>
                <th className="p-3">Channel</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
                <th className="p-3">Delivered</th>
                <th className="p-3">Tapped OK</th>
                <th className="p-3">Failed</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredDeliveries.map((delivery) => (
                <tr key={delivery.id}>
                  <td className="p-3 font-medium">{delivery.fullName}</td>
                  <td className="p-3 font-mono text-xs">{delivery.maskedPhone ?? "—"}</td>
                  <td className="p-3">{delivery.channel}</td>
                  <td className="p-3"><Badge variant="outline">{formatStatus(delivery.status)}</Badge></td>
                  <td className="whitespace-nowrap p-3 text-xs">{formatDate(delivery.createdAt)}</td>
                  <td className="whitespace-nowrap p-3 text-xs">{formatDate(delivery.deliveredAt)}</td>
                  <td className="whitespace-nowrap p-3 text-xs">{formatDate(delivery.tappedOkAt)}</td>
                  <td className="whitespace-nowrap p-3 text-xs">{formatDate(delivery.failedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            Per-recipient assignment group, geographic area, and source citation are not available in the delivery records.
          </p>
        </div>
      )}

      {deliveriesQuery.hasNextPage && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => void deliveriesQuery.fetchNextPage()}
            disabled={deliveriesQuery.isFetchingNextPage}
          >
            {deliveriesQuery.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ReportPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <BroadcastReport id={id} />;
}

export default function LiveBroadcastReport({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading report…</p>}>
      <ReportPageContent params={params} />
    </Suspense>
  );
}
