"use client";

import React, { useState, useMemo, use, Suspense } from "react";
import { BROADCASTS_DATA, SAMPLE_DELIVERY_LOGS } from "@/lib/data/broadcasts-data";
import { BroadcastData, BroadcastRecipientLog } from "@/lib/types";
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
  // Find broadcast or default to bc-1
  const initialBroadcast =
    BROADCASTS_DATA.find((b) => b.id === id) || BROADCASTS_DATA[0];

  const [broadcast, setBroadcast] = useState<BroadcastData>(initialBroadcast);
  const [logs, setLogs] = useState<BroadcastRecipientLog[]>(
    initialBroadcast.recipientsList && initialBroadcast.recipientsList.length > 0
      ? initialBroadcast.recipientsList
      : SAMPLE_DELIVERY_LOGS
  );

  const [statusTab, setStatusTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [isMessageModalOpen, setIsMessageModalOpen] = useState<boolean>(false);

  // Resending states
  const [isResendingAllFailed, setIsResendingAllFailed] = useState<boolean>(false);
  const [resendingLogId, setResendingLogId] = useState<string | null>(null);
  const [resendSuccessBanner, setResendSuccessBanner] = useState<string | null>(null);

  // Compute status counts for filters
  const statusCounts = useMemo(() => {
    return {
      all: logs.length,
      tappedOk: logs.filter((l) => l.status === "Tapped OK").length,
      delivered: logs.filter((l) => l.status === "Delivered").length,
      deliveredBySms: logs.filter((l) => l.status === "Delivered by SMS").length,
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

  // Batch Resend Failed
  const handleResendAllFailed = () => {
    setIsResendingAllFailed(true);

    setTimeout(() => {
      // Convert all failed logs to Delivered
      setLogs((prev) =>
        prev.map((log) =>
          log.status === "Failed" || log.status === "Pending"
            ? { ...log, status: "Delivered", time: "Just now" }
            : log
        )
      );

      // Update broadcast metrics
      setBroadcast((prev) => ({
        ...prev,
        delivered: prev.delivered + prev.failed + prev.pending,
        failed: 0,
        pending: 0,
        deliveredPct: 100,
      }));

      setIsResendingAllFailed(false);
      setResendSuccessBanner(
        "Successfully re-transmitted alerts to all failed recipients via SMS fallback."
      );

      setTimeout(() => {
        setResendSuccessBanner(null);
      }, 4000);
    }, 1200);
  };

  // Single Resend
  const handleResendSingle = (logId: string) => {
    setResendingLogId(logId);

    setTimeout(() => {
      setLogs((prev) =>
        prev.map((l) =>
          l.id === logId ? { ...l, status: "Delivered", time: "Just now" } : l
        )
      );
      setResendingLogId(null);
    }, 800);
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
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
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
              disabled={isResendingAllFailed}
              onClick={handleResendAllFailed}
              className="text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isResendingAllFailed ? "animate-spin" : ""}`} />
              <span>Resend to {broadcast.failed} Failed</span>
            </Button>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {resendSuccessBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{resendSuccessBanner}</span>
          </div>
        </div>
      )}

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
      <ReportLogsTable
        logs={filteredLogs}
        onResendSingle={handleResendSingle}
        resendingId={resendingLogId}
      />

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
