"use client";

import React, { useState, useMemo, use, Suspense } from "react";
import { BROADCASTS_DATA, SAMPLE_DELIVERY_LOGS } from "@/lib/data/broadcasts-data";
import { BroadcastData, BroadcastRecipientLog } from "@/lib/types";
import { useBroadcastDetail, useBroadcastDeliveries } from "@/lib/hooks/use-broadcasts";
import { ReportKPISummary } from "@/components/broadcasts/report/report-kpi-summary";
import { ReportFilters } from "@/components/broadcasts/report/report-filters";
import { ReportLogsTable } from "@/components/broadcasts/report/report-logs-table";
import { ReportMessageModal } from "@/components/broadcasts/report/report-message-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Send,
  RotateCw,
  FileText,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Radio,
  MapPin,
  Clock,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

interface BroadcastDeliveryReportPageProps {
  params: Promise<{ id: string }>;
}

export function BroadcastDeliveryReportContent({ id }: { id: string }) {
  const {
    data: detail,
    isLoading: isDetailLoading,
    refetch: refetchDetail,
  } = useBroadcastDetail(id);

  const {
    data: deliveriesData,
    refetch: refetchDeliveries,
  } = useBroadcastDeliveries(id);

  const fallbackMock = useMemo(() => {
    return BROADCASTS_DATA.find((b) => b.id === id);
  }, [id]);

  if (isDetailLoading) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-8 rounded-xl border border-border bg-card text-center space-y-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-foreground">Loading delivery report...</p>
        <p className="text-xs text-muted-foreground">
          Fetching broadcast metrics and real-time recipient logs.
        </p>
      </div>
    );
  }

  // If live detail found from API
  if (detail) {
    const totalDispatches =
      (detail.counts?.pending ?? 0) +
      (detail.counts?.sent ?? 0) +
      (detail.counts?.delivered ?? 0) +
      (detail.counts?.failed ?? 0) +
      (detail.counts?.tapped_ok ?? 0);

    const sentCount = totalDispatches || (detail.counts?.sent ?? 0) || 1;
    const delivered = detail.counts?.delivered ?? 0;
    const tappedOk = detail.counts?.tapped_ok ?? 0;
    const pending = detail.counts?.pending ?? 0;
    const failed = detail.counts?.failed ?? 0;

    const liveBroadcast: BroadcastData = {
      id: detail.id,
      title: `Broadcast #${detail.id.slice(0, 8)}`,
      targetArea: "Target Audience",
      senderRole: "Admin",
      sentAt: detail.createdAt
        ? new Date(detail.createdAt).toLocaleString("en-GB", {
            timeZone: "Africa/Lagos",
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "Just now",
      timestamp: detail.createdAt,
      candidatesCount: 0,
      agentsCount: totalDispatches,
      status:
        detail.status === "completed"
          ? "Sent"
          : detail.status === "scheduled"
          ? "Scheduled"
          : detail.status === "failed"
          ? "Failed"
          : "Sent",
      channel: "Telegram Bot",
      sent: sentCount,
      delivered,
      deliveredPct: sentCount > 0 ? Math.round((delivered / sentCount) * 100) : 0,
      tappedOk,
      tappedOkPct: sentCount > 0 ? Math.round((tappedOk / sentCount) * 100) : 0,
      pending,
      failed,
      messageContent: fallbackMock?.messageContent,
    };

    const liveLogs: BroadcastRecipientLog[] =
      deliveriesData?.items && deliveriesData.items.length > 0
        ? deliveriesData.items.map((del) => ({
            id: del.id,
            name: del.fullName,
            group: del.channel === "telegram" ? "Telegram Agent" : "Official Agent",
            area: "Assigned Polling Unit",
            time:
              del.sentAt || del.createdAt
                ? new Date(del.sentAt || del.createdAt).toLocaleTimeString("en-GB", {
                    timeZone: "Africa/Lagos",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "--:--",
            status:
              del.status === "tapped_ok"
                ? "Tapped OK"
                : del.status === "delivered"
                ? "Delivered"
                : del.status === "failed"
                ? "Failed"
                : "Pending",
            source: "Telegram Bot",
            phoneMasked: del.maskedPhone || "+234 ••• ••• •••",
          }))
        : [];

    return (
      <BroadcastDeliveryReportBody
        initialBroadcast={liveBroadcast}
        initialLogs={liveLogs}
        onRefresh={() => {
          refetchDetail();
          refetchDeliveries();
        }}
      />
    );
  }

  // Fallback to static mock if available
  if (fallbackMock) {
    const mockLogs: BroadcastRecipientLog[] =
      fallbackMock.recipientsList && fallbackMock.recipientsList.length > 0
        ? fallbackMock.recipientsList
        : SAMPLE_DELIVERY_LOGS;

    return (
      <BroadcastDeliveryReportBody
        initialBroadcast={fallbackMock}
        initialLogs={mockLogs}
      />
    );
  }

  // Not found in API or mock data
  return (
    <div className="max-w-xl mx-auto mt-16 p-6 rounded-xl border border-border bg-card text-center space-y-3">
      <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto" />
      <p className="text-sm font-semibold text-foreground">Broadcast not found</p>
      <p className="text-xs text-muted-foreground">
        This broadcast does not exist or you do not have access to it.
      </p>
      <Link
        href="/broadcasts"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to broadcasts
      </Link>
    </div>
  );
}

function BroadcastDeliveryReportBody({
  initialBroadcast,
  initialLogs,
  onRefresh,
}: {
  initialBroadcast: BroadcastData;
  initialLogs: BroadcastRecipientLog[];
  onRefresh?: () => void;
}) {
  const broadcast = initialBroadcast;
  const logs = initialLogs;

  const [statusTab, setStatusTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [isMessageModalOpen, setIsMessageModalOpen] = useState<boolean>(false);

  // Compute status counts for filters
  const statusCounts = useMemo(() => {
    return {
      all: logs.length,
      tappedOk: logs.filter((l) => l.status === "Tapped OK").length,
      delivered: logs.filter((l) => l.status === "Delivered").length,
      pending: logs.filter((l) => l.status === "Pending").length,
      failed: logs.filter((l) => l.status === "Failed").length,
    };
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Status filter
      if (statusTab !== "all" && log.status !== statusTab) {
        return false;
      }

      // Search query
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesName = log.name.toLowerCase().includes(query);
        const matchesArea = log.area.toLowerCase().includes(query);
        const matchesGroup = log.group.toLowerCase().includes(query);
        const matchesPhone = log.phoneMasked?.toLowerCase().includes(query) || false;
        if (!matchesName && !matchesArea && !matchesGroup && !matchesPhone) {
          return false;
        }
      }

      // Group filter
      if (selectedGroup !== "all") {
        if (selectedGroup === "candidate") {
          if (
            !log.group.toLowerCase().includes("ndc") &&
            !log.group.toLowerCase().includes("senate") &&
            !log.group.toLowerCase().includes("reps") &&
            !log.group.toLowerCase().includes("assembly")
          ) {
            return false;
          }
        } else if (selectedGroup === "official") {
          if (!log.group.toLowerCase().includes("official")) {
            return false;
          }
        } else if (selectedGroup === "extra") {
          if (!log.group.toLowerCase().includes("extra")) {
            return false;
          }
        }
      }

      return true;
    });
  }, [logs, statusTab, searchQuery, selectedGroup]);

  const isFiltered =
    statusTab !== "all" || searchQuery.trim() !== "" || selectedGroup !== "all";

  const handleResetFilters = () => {
    setStatusTab("all");
    setSearchQuery("");
    setSelectedGroup("all");
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "Recipient ID",
      "Name",
      "Role / Group",
      "Area / Polling Unit",
      "Dispatched Time",
      "Delivery Status",
      "Source Citation",
      "Phone (Masked)",
    ];
    const rows = filteredLogs.map((l) => [
      l.id,
      `"${l.name.replace(/"/g, '""')}"`,
      `"${l.group.replace(/"/g, '""')}"`,
      `"${l.area.replace(/"/g, '""')}"`,
      `"${l.time} WAT"`,
      l.status,
      `"${l.source.replace(/"/g, '""')}"`,
      `"${l.phoneMasked || ""}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `ndc-delivery-report-${broadcast.id}-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 text-xs text-muted-foreground">
            <Link
              href="/broadcasts"
              className="hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Broadcasts</span>
            </Link>
            <span>/</span>
            <span className="text-foreground font-semibold">Delivery Report</span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
              {broadcast.title}
            </h1>
            <Badge
              variant="outline"
              className="text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
            >
              {broadcast.status}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
            <span className="flex items-center gap-1 font-medium text-foreground">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{broadcast.targetArea}</span>
            </span>
            <span>•</span>
            <span>Sent {broadcast.sentAt}</span>
            <span>•</span>
            <span className="font-mono">{broadcast.channel}</span>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="text-xs gap-1.5 border-border"
            >
              <RotateCw className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Refresh</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMessageModalOpen(true)}
            className="text-xs gap-1.5 border-border"
          >
            <FileText className="w-3.5 h-3.5 text-primary" />
            <span>View Copy</span>
          </Button>

          {broadcast.failed > 0 && (
            <Button
              size="sm"
              disabled
              title="Not available yet"
              className="text-xs gap-1.5 font-semibold"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Resend to {broadcast.failed} Failed: Not available yet</span>
            </Button>
          )}
        </div>
      </div>

      {/* KPI Metrics Summary */}
      <ReportKPISummary broadcast={broadcast} />

      {/* Filter Toolbar */}
      <ReportFilters
        statusTab={statusTab}
        onStatusTabChange={setStatusTab}
        statusCounts={statusCounts}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedGroup={selectedGroup}
        onGroupChange={setSelectedGroup}
        onReset={handleResetFilters}
        isFiltered={isFiltered}
        onExportCSV={handleExportCSV}
      />

      {/* Delivery Logs Table */}
      <ReportLogsTable logs={filteredLogs} />

      {/* Message Copy Modal */}
      <ReportMessageModal
        broadcast={broadcast}
        open={isMessageModalOpen}
        onOpenChange={setIsMessageModalOpen}
      />
    </div>
  );
}

function ReportPageInner({ params }: BroadcastDeliveryReportPageProps) {
  const unwrappedParams = use(params);
  return <BroadcastDeliveryReportContent id={unwrappedParams.id} />;
}

export default function BroadcastDeliveryReportPage({
  params,
}: BroadcastDeliveryReportPageProps) {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-xs text-muted-foreground">
          Loading broadcast delivery logs...
        </div>
      }
    >
      <ReportPageInner params={params} />
    </Suspense>
  );
}
