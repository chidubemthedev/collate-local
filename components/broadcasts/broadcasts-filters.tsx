"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  LayoutGrid,
  Table as TableIcon,
  Download,
  RotateCcw,
  Send,
  Clock,
  FileEdit,
} from "lucide-react";
import Link from "next/link";

interface BroadcastsFiltersProps {
  statusTab: "all" | "Sent" | "Scheduled" | "Draft";
  onStatusTabChange: (tab: "all" | "Sent" | "Scheduled" | "Draft") => void;
  statusCounts: {
    all: number;
    sent: number;
    scheduled: number;
    draft: number;
  };
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedScope: string;
  onScopeChange: (scope: string) => void;
  selectedSenderRole: string;
  onSenderRoleChange: (role: string) => void;
  selectedChannel?: string;
  onChannelChange?: (channel: string) => void;
  viewMode: "cards" | "table";
  onViewModeChange: (mode: "cards" | "table") => void;
  onReset: () => void;
  isFiltered: boolean;
  onExportCSV: () => void;
}

export function BroadcastsFilters({
  statusTab,
  onStatusTabChange,
  statusCounts,
  searchQuery,
  onSearchChange,
  selectedScope,
  onScopeChange,
  selectedSenderRole,
  onSenderRoleChange,
  selectedChannel = "all",
  onChannelChange,
  viewMode,
  onViewModeChange,
  onReset,
  isFiltered,
  onExportCSV,
}: BroadcastsFiltersProps) {
  return (
    <div className="bg-card border border-border/70 rounded-xl p-3.5 sm:p-4 space-y-3.5">
      {/* Top Bar: Status Tabs + New Broadcast CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        {/* Status Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => onStatusTabChange("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusTab === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>All Campaigns</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                statusTab === "all"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-background text-muted-foreground"
              }`}
            >
              {statusCounts.all}
            </span>
          </button>

          <button
            onClick={() => onStatusTabChange("Sent")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusTab === "Sent"
                ? "bg-emerald-600 text-white"
                : "bg-muted/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Sent & Delivered</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                statusTab === "Sent"
                  ? "bg-white/20 text-white"
                  : "bg-background text-muted-foreground"
              }`}
            >
              {statusCounts.sent}
            </span>
          </button>

          <button
            onClick={() => onStatusTabChange("Scheduled")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusTab === "Scheduled"
                ? "bg-blue-600 text-white"
                : "bg-muted/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Scheduled</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                statusTab === "Scheduled"
                  ? "bg-white/20 text-white"
                  : "bg-background text-muted-foreground"
              }`}
            >
              {statusCounts.scheduled}
            </span>
          </button>

          <button
            onClick={() => onStatusTabChange("Draft")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusTab === "Draft"
                ? "bg-slate-700 text-white dark:bg-slate-600"
                : "bg-muted/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span>Drafts</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                statusTab === "Draft"
                  ? "bg-white/20 text-white"
                  : "bg-background text-muted-foreground"
              }`}
            >
              {statusCounts.draft}
            </span>
          </button>
        </div>

        {/* Right Action: New Broadcast Button */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/broadcasts/new"
            className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-xs font-semibold transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-8.5 px-3 py-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Broadcast</span>
          </Link>
        </div>
      </div>

      {/* Main Filter Controls Grid: Strict 2-col on mobile, equal-width 4-col on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 w-full">
        {/* Search Box */}
        <div className="relative min-w-0 w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search title, content..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8.5 h-8.5 text-xs bg-background w-full"
          />
        </div>

        {/* Target Geography Selector */}
        <div className="min-w-0 w-full">
          <Select value={selectedScope} onValueChange={(v) => v && onScopeChange(v)}>
            <SelectTrigger className="h-8.5 text-xs bg-background w-full">
              <SelectValue placeholder="Target Geography">
                {(val) => {
                  if (!val || val === "all") return "All Geographies";
                  const labels: Record<string, string> = {
                    national: "Nigeria (National)",
                    "04": "04 · Anambra State",
                    "24": "24 · Lagos State",
                    "19": "19 · Kano State",
                    "04-17": "04-17 · Onitsha North LGA",
                  };
                  return labels[val] || val;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Geographies</SelectItem>
              <SelectItem value="national">Nigeria (National)</SelectItem>
              <SelectItem value="04">04 · Anambra State</SelectItem>
              <SelectItem value="24">24 · Lagos State</SelectItem>
              <SelectItem value="19">19 · Kano State</SelectItem>
              <SelectItem value="04-17">04-17 · Onitsha North LGA</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sender Role Selector */}
        <div className="min-w-0 w-full">
          <Select value={selectedSenderRole} onValueChange={(v) => v && onSenderRoleChange(v)}>
            <SelectTrigger className="h-8.5 text-xs bg-background w-full">
              <SelectValue placeholder="Sender Role">
                {(val) => {
                  if (!val || val === "all") return "All Senders";
                  const labels: Record<string, string> = {
                    Party: "Party · National",
                    Candidate: "Candidates",
                    Admin: "Admin · System",
                  };
                  return labels[val] || val;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Senders</SelectItem>
              <SelectItem value="Party">Party · National</SelectItem>
              <SelectItem value="Candidate">Candidates</SelectItem>
              <SelectItem value="Admin">Admin · System</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Delivery Channel Selector */}
        <div className="min-w-0 w-full">
          <Select
            value={selectedChannel}
            onValueChange={(v) => v && onChannelChange && onChannelChange(v)}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background w-full">
              <SelectValue placeholder="Delivery Channel">
                {(val) => {
                  if (!val || val === "all") return "All Channels";
                  const labels: Record<string, string> = {
                    Telegram: "Telegram",
                    SMS: "SMS",
                  };
                  return labels[val] || val;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="Telegram">Telegram</SelectItem>
              <SelectItem value="SMS">SMS</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bottom Bar: Filter Status / Reset + View Switcher & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 text-xs">
        {/* Reset Filter Button if active */}
        <div className="flex items-center gap-2">
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </Button>
          )}
        </div>

        {/* View Toggle & CSV Export */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Card / Table Toggle */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/70">
            <button
              onClick={() => onViewModeChange("cards")}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === "cards"
                  ? "bg-background text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onViewModeChange("table")}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === "table"
                  ? "bg-background text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Export CSV Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onExportCSV}
            className="h-8 text-xs font-medium gap-1.5 border-border/70"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
