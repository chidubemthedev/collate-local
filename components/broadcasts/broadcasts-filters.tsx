"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Radio,
  Send,
  Clock,
  FileEdit,
  Filter,
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
  viewMode,
  onViewModeChange,
  onReset,
  isFiltered,
  onExportCSV,
}: BroadcastsFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Top Bar: Status Tabs + New Broadcast CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        {/* Status Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          <button
            onClick={() => onStatusTabChange("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusTab === "all"
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span>All Campaigns</span>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 border-0 ${
                statusTab === "all"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-background/80 text-muted-foreground"
              }`}
            >
              {statusCounts.all}
            </Badge>
          </button>

          <button
            onClick={() => onStatusTabChange("Sent")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusTab === "Sent"
                ? "bg-emerald-600 text-white shadow-xs font-semibold"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Sent & Delivered</span>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 border-0 ${
                statusTab === "Sent"
                  ? "bg-white/20 text-white"
                  : "bg-background/80 text-muted-foreground"
              }`}
            >
              {statusCounts.sent}
            </Badge>
          </button>

          <button
            onClick={() => onStatusTabChange("Scheduled")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusTab === "Scheduled"
                ? "bg-blue-600 text-white shadow-xs font-semibold"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Scheduled</span>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 border-0 ${
                statusTab === "Scheduled"
                  ? "bg-white/20 text-white"
                  : "bg-background/80 text-muted-foreground"
              }`}
            >
              {statusCounts.scheduled}
            </Badge>
          </button>

          <button
            onClick={() => onStatusTabChange("Draft")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusTab === "Draft"
                ? "bg-slate-700 text-white shadow-xs font-semibold dark:bg-slate-600"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span>Drafts</span>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 border-0 ${
                statusTab === "Draft"
                  ? "bg-white/20 text-white"
                  : "bg-background/80 text-muted-foreground"
              }`}
            >
              {statusCounts.draft}
            </Badge>
          </button>
        </div>

        {/* Right Action: New Broadcast Button */}
        <div className="flex items-center gap-2">
          <Link
            href="/broadcasts/new"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 h-9 px-4 py-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Broadcast</span>
          </Link>
        </div>
      </div>

      {/* Second Row: Search, Dropdowns, View Switcher & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search title, content, or location..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8.5 h-9 text-xs bg-background"
            />
          </div>

          {/* Scope / Geography Selector */}
          <div className="w-[170px]">
            <Select value={selectedScope} onValueChange={(v) => v && onScopeChange(v)}>
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder="Target Geography" />
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
          <div className="w-[160px]">
            <Select value={selectedSenderRole} onValueChange={(v) => v && onSenderRoleChange(v)}>
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder="Sender Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Senders</SelectItem>
                <SelectItem value="Party">Party · National</SelectItem>
                <SelectItem value="Candidate">Candidates</SelectItem>
                <SelectItem value="Admin">Admin · System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset Filters button */}
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset
            </Button>
          )}
        </div>

        {/* View Toggle & CSV Export */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          {/* Card / Table Toggle */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border">
            <button
              onClick={() => onViewModeChange("cards")}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === "cards"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange("table")}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === "table"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Export CSV Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onExportCSV}
            className="h-9 text-xs font-medium gap-1.5 border-border"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Log</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
