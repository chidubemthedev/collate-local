"use client";

import React from "react";
import { STATES_DATA } from "@/lib/data/inec-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TableToolbar } from "@/components/ui/table-toolbar";
import {
  Search,
  Filter,
  RotateCcw,
  LayoutGrid,
  List,
  Download,
  Send,
  Building,
} from "lucide-react";
import Link from "next/link";

interface CandidatesFiltersProps {
  selectedOffice: string;
  setSelectedOffice: (office: string) => void;
  selectedState: string;
  setSelectedState: (state: string) => void;
  selectedChannel: string;
  setSelectedChannel: (channel: string) => void;
  selectedCoverageTier: string;
  setSelectedCoverageTier: (tier: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  viewMode: "table" | "cards";
  setViewMode: (mode: "table" | "cards") => void;
  officeCounts: Record<string, number>;
  totalCount: number;
  onReset: () => void;
  onExportCSV: () => void;
}

export function CandidatesFilters({
  selectedOffice,
  setSelectedOffice,
  selectedState,
  setSelectedState,
  selectedChannel,
  setSelectedChannel,
  selectedCoverageTier,
  setSelectedCoverageTier,
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  officeCounts,
  totalCount,
  onReset,
  onExportCSV,
}: CandidatesFiltersProps) {
  const officeTabs = [
    { id: "all", label: "All Tickets", count: officeCounts.all || 0 },
    { id: "President", label: "Presidency", count: officeCounts.President || 0 },
    { id: "Governor", label: "Governors", count: officeCounts.Governor || 0 },
    { id: "Senate", label: "Senate", count: officeCounts.Senate || 0 },
    { id: "House of Reps", label: "House of Reps", count: officeCounts["House of Reps"] || 0 },
    { id: "State Assembly", label: "State Assembly", count: officeCounts["State Assembly"] || 0 },
  ];

  return (
    <div className="space-y-3">
      {/* Top Bar: Office Tabs & View Mode */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border/60">
        {/* Office Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {officeTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedOffice(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedOffice === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedOffice === tab.id
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-background text-muted-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg shrink-0 w-fit">
          <button
            onClick={() => setViewMode("table")}
            className={`p-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === "table"
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Table View"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode("cards")}
            className={`p-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === "cards"
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Cards View"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Filter Controls Grid: Strict 2-col on mobile, 4-col on desktop */}
      <TableToolbar
        onClear={onReset}
        activeFilters={[
          ...(selectedState !== "all" ? [{ id: "state", label: `State: ${STATES_DATA.find((state) => state.code === selectedState)?.name ?? selectedState}`, onRemove: () => setSelectedState("all") }] : []),
          ...(selectedChannel !== "all" ? [{ id: "channel", label: `Channel: ${selectedChannel}`, onRemove: () => setSelectedChannel("all") }] : []),
          ...(selectedCoverageTier !== "all" ? [{ id: "coverage", label: `Coverage: ${selectedCoverageTier}`, onRemove: () => setSelectedCoverageTier("all") }] : []),
          ...(searchQuery ? [{ id: "search", label: `Search: ${searchQuery}`, onRemove: () => setSearchQuery("") }] : []),
          ...(selectedOffice !== "all" ? [{ id: "office", label: `Office: ${selectedOffice}`, onRemove: () => setSelectedOffice("all") }] : []),
        ]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onExportCSV}
              className="text-xs h-7.5 gap-1.5 px-2.5"
            >
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Export CSV</span>
            </Button>
            <Link
              href="/broadcasts/new?group=candidates"
              className="inline-flex items-center justify-center rounded-lg text-xs font-medium h-7.5 px-3 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Message Filtered</span>
            </Link>
          </>
        }
      >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* State Filter */}
        <div className="space-y-1 min-w-0 w-full">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block truncate">
            State
          </label>
          <Select
            value={selectedState}
            onValueChange={(val) => {
              if (val) setSelectedState(val);
            }}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background w-full">
              <SelectValue placeholder="All States">
                {(val) => {
                  if (!val || val === "all") return "All States";
                  const found = STATES_DATA.find((st) => st.code === val);
                  return found ? found.name : val;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {STATES_DATA.map((st) => (
                <SelectItem key={st.code} value={st.code}>
                  {st.name} ({st.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Channel Status Filter */}
        <div className="space-y-1 min-w-0 w-full">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block truncate">
            Channel Status
          </label>
          <Select
            value={selectedChannel}
            onValueChange={(val) => {
              if (val) setSelectedChannel(val);
            }}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background w-full">
              <SelectValue placeholder="All Channels">
                {(val) => {
                  if (!val || val === "all") return "All Channels";
                  if (val === "connected") return "Telegram Connected";
                  if (val === "sms_only") return "SMS Fallback Only";
                  if (val === "not_matched") return "Number Not Matched";
                  return val;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="connected">Telegram Connected</SelectItem>
              <SelectItem value="sms_only">SMS Fallback Only</SelectItem>
              <SelectItem value="not_matched">Number Not Matched</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Coverage Tier Filter */}
        <div className="space-y-1 min-w-0 w-full">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block truncate">
            Coverage Tier
          </label>
          <Select
            value={selectedCoverageTier}
            onValueChange={(val) => {
              if (val) setSelectedCoverageTier(val);
            }}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background w-full">
              <SelectValue placeholder="All Tiers">
                {(val) => {
                  if (!val || val === "all") return "All Tiers";
                  if (val === "high") return "High (≥50%)";
                  if (val === "medium") return "Medium (30–49%)";
                  if (val === "critical") return "Critical (<30%)";
                  return val;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="high">High (≥50%)</SelectItem>
              <SelectItem value="medium">Medium (30–49%)</SelectItem>
              <SelectItem value="critical">Critical (&lt;30%)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="order-first space-y-1 min-w-0 w-full">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block truncate">
            Search
          </label>
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Candidate name or seat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8.5 text-xs bg-background w-full"
            />
          </div>
        </div>
      </div>

      </TableToolbar>
      <p className="text-xs text-muted-foreground">
        Showing <strong className="text-foreground">{totalCount}</strong> candidate ticket{totalCount !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
