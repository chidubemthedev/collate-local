"use client";

import React, { useState, useMemo } from "react";
import { BROADCASTS_DATA } from "@/lib/data/broadcasts-data";
import { BroadcastData } from "@/lib/types";
import { useApp } from "@/lib/context/app-context";
import { BroadcastsKPISummary } from "@/components/broadcasts/broadcasts-kpi-summary";
import { BroadcastsFilters } from "@/components/broadcasts/broadcasts-filters";
import { BroadcastCard } from "@/components/broadcasts/broadcast-card";
import { BroadcastsTable } from "@/components/broadcasts/broadcasts-table";
import { BroadcastPreviewModal } from "@/components/broadcasts/broadcast-preview-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Send,
  Radio,
  Plus,
  RotateCcw,
  Sparkles,
  Inbox,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

export default function BroadcastsPage() {
  const { activePersona } = useApp();

  const [statusTab, setStatusTab] = useState<"all" | "Sent" | "Scheduled" | "Draft">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedScope, setSelectedScope] = useState<string>("all");
  const [selectedSenderRole, setSelectedSenderRole] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [previewBroadcast, setPreviewBroadcast] = useState<BroadcastData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  const isCandidatePersona = activePersona.role.startsWith("Candidate");

  // Filter broadcasts based on activePersona and filters
  const filteredBroadcasts = useMemo(() => {
    return BROADCASTS_DATA.filter((broadcast) => {
      // 1. Status Tab Filter
      if (statusTab !== "all" && broadcast.status !== statusTab) {
        return false;
      }

      // 2. Search Query Filter
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesTitle = broadcast.title.toLowerCase().includes(query);
        const matchesTarget = broadcast.targetArea.toLowerCase().includes(query);
        const matchesContent = broadcast.messageContent?.toLowerCase().includes(query) || false;
        const matchesSender = broadcast.senderRole.toLowerCase().includes(query);
        if (!matchesTitle && !matchesTarget && !matchesContent && !matchesSender) {
          return false;
        }
      }

      // 3. Scope Filter
      if (selectedScope !== "all") {
        if (selectedScope === "national") {
          if (!broadcast.targetArea.toLowerCase().includes("national") && !broadcast.targetArea.toLowerCase().includes("nigeria")) {
            return false;
          }
        } else if (broadcast.stateCode !== selectedScope && broadcast.lgaCode !== selectedScope) {
          return false;
        }
      }

      // 4. Sender Role Filter
      if (selectedSenderRole !== "all") {
        if (!broadcast.senderRole.toLowerCase().includes(selectedSenderRole.toLowerCase())) {
          return false;
        }
      }

      // 5. Persona Scoping (if candidate is viewing)
      if (isCandidatePersona) {
        if (activePersona.stateCode && broadcast.stateCode) {
          if (broadcast.stateCode !== activePersona.stateCode && !broadcast.targetArea.includes("National")) {
            return false;
          }
        }
      }

      return true;
    });
  }, [statusTab, searchQuery, selectedScope, selectedSenderRole, isCandidatePersona, activePersona]);

  // Counts for status tabs
  const statusCounts = useMemo(() => {
    return {
      all: BROADCASTS_DATA.length,
      sent: BROADCASTS_DATA.filter((b) => b.status === "Sent").length,
      scheduled: BROADCASTS_DATA.filter((b) => b.status === "Scheduled").length,
      draft: BROADCASTS_DATA.filter((b) => b.status === "Draft").length,
    };
  }, []);

  const isFiltered =
    statusTab !== "all" ||
    searchQuery.trim() !== "" ||
    selectedScope !== "all" ||
    selectedSenderRole !== "all";

  const handleResetFilters = () => {
    setStatusTab("all");
    setSearchQuery("");
    setSelectedScope("all");
    setSelectedSenderRole("all");
  };

  const handleOpenPreview = (broadcast: BroadcastData) => {
    setPreviewBroadcast(broadcast);
    setIsPreviewOpen(true);
  };

  const handleExportCSV = () => {
    const headers = [
      "Campaign ID",
      "Title",
      "Status",
      "Target Area",
      "Sender Role",
      "Channel",
      "Timestamp",
      "Total Sent",
      "Delivered",
      "Delivered %",
      "Delivered by SMS",
      "Tapped OK",
      "Tapped OK %",
      "Failed",
    ];

    const rows = filteredBroadcasts.map((b) => [
      b.id,
      `"${b.title.replace(/"/g, '""')}"`,
      b.status,
      `"${b.targetArea.replace(/"/g, '""')}"`,
      `"${b.senderRole.replace(/"/g, '""')}"`,
      `"${b.channel.replace(/"/g, '""')}"`,
      `"${b.sentAt}"`,
      b.sent,
      b.delivered,
      `${b.deliveredPct}%`,
      b.deliveredBySms || 0,
      b.tappedOk,
      `${b.tappedOkPct}%`,
      b.failed,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ndc-broadcasts-export-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
              <Send className="w-7 h-7 text-primary" />
              <span>Broadcasts</span>
            </h1>
            <Badge
              variant="outline"
              className="text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Telegram + SMS Live
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
            Send, track, and schedule mass alerts via Telegram and SMS to candidates and polling unit
            agents with 1-tap confirmation tracking.
          </p>
        </div>

        {/* Header Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/broadcasts/new"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-semibold transition-all bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 h-10 px-4 py-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Broadcast</span>
          </Link>
        </div>
      </div>

      {/* KPI Metrics Summary */}
      <BroadcastsKPISummary broadcasts={BROADCASTS_DATA} />

      {/* Filters & Search Toolbar */}
      <BroadcastsFilters
        statusTab={statusTab}
        onStatusTabChange={setStatusTab}
        statusCounts={statusCounts}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedScope={selectedScope}
        onScopeChange={setSelectedScope}
        selectedSenderRole={selectedSenderRole}
        onSenderRoleChange={setSelectedSenderRole}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onReset={handleResetFilters}
        isFiltered={isFiltered}
        onExportCSV={handleExportCSV}
      />

      {/* Persona Notice if Scoped */}
      {isCandidatePersona && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              Showing campaigns relevant to <strong>{activePersona.label}</strong> ({activePersona.office}).
            </span>
          </div>
          <Badge variant="outline" className="bg-background text-amber-700 dark:text-amber-300 border-amber-300 text-[11px]">
            Candidate Subtree
          </Badge>
        </div>
      )}

      {/* Content Section: Cards vs Table */}
      {filteredBroadcasts.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-2xl bg-card space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
            <Inbox className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">No broadcast campaigns found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No broadcasts match your active status or search filters. Try resetting filters or
              compose a new broadcast alert.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            {isFiltered && (
              <Button variant="outline" size="sm" onClick={handleResetFilters} className="text-xs">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Reset Filters
              </Button>
            )}
            <Link
              href="/broadcasts/new"
              className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Campaign</span>
            </Link>
          </div>
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBroadcasts.map((broadcast) => (
            <BroadcastCard
              key={broadcast.id}
              broadcast={broadcast}
              onPreview={handleOpenPreview}
            />
          ))}
        </div>
      ) : (
        <BroadcastsTable
          broadcasts={filteredBroadcasts}
          onPreview={handleOpenPreview}
        />
      )}

      {/* Interactive Telegram / SMS Preview Modal */}
      <BroadcastPreviewModal
        broadcast={previewBroadcast}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
      />
    </div>
  );
}
