"use client";

import React from "react";
import { STATES_DATA } from "@/lib/data/inec-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
    <div className="bg-card border border-border/80 rounded-xl p-3 sm:p-4 shadow-sm space-y-3">
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
                  ? "bg-primary text-primary-foreground shadow-sm"
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
                ? "bg-background text-foreground shadow-sm"
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
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Cards View"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Filter Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* State Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            State
          </label>
          <Select
            value={selectedState}
            onValueChange={(val) => {
              if (val) setSelectedState(val);
            }}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background">
              <SelectValue placeholder="All States" />
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
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Channel Status
          </label>
          <Select
            value={selectedChannel}
            onValueChange={(val) => {
              if (val) setSelectedChannel(val);
            }}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background">
              <SelectValue placeholder="All Channels" />
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
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Coverage Tier
          </label>
          <Select
            value={selectedCoverageTier}
            onValueChange={(val) => {
              if (val) setSelectedCoverageTier(val);
            }}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background">
              <SelectValue placeholder="All Tiers" />
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
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Search
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Candidate name or seat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8.5 text-xs bg-background"
            />
          </div>
        </div>
      </div>

      {/* Bottom Action / Reset Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            Showing <strong className="text-foreground">{totalCount}</strong> candidate ticket{totalCount !== 1 ? "s" : ""}
          </span>
          {(selectedOffice !== "all" ||
            selectedState !== "all" ||
            selectedChannel !== "all" ||
            selectedCoverageTier !== "all" ||
            searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-6 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
            >
              <RotateCcw className="w-3 h-3" />
              Reset filters
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
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
            href={`/broadcasts/new?group=candidates`}
            className="inline-flex items-center justify-center rounded-lg text-xs font-medium h-7.5 px-3 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Message Filtered</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
