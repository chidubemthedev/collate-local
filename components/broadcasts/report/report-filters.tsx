"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  CheckCircle2,
  CheckCheck,
  Clock,
  AlertTriangle,
  RotateCcw,
  Download,
} from "lucide-react";

interface StatusCounts {
  all: number;
  tappedOk: number;
  delivered: number;
  pending: number;
  failed: number;
}

interface ReportFiltersProps {
  statusTab: string;
  onStatusTabChange: (tab: string) => void;
  statusCounts: StatusCounts;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedGroup: string;
  onGroupChange: (group: string) => void;
  onReset: () => void;
  isFiltered: boolean;
  onExportCSV: () => void;
}

export function ReportFilters({
  statusTab,
  onStatusTabChange,
  statusCounts,
  searchQuery,
  onSearchChange,
  selectedGroup,
  onGroupChange,
  onReset,
  isFiltered,
  onExportCSV,
}: ReportFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Top Status Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-border pb-3">
        {/* All */}
        <button
          onClick={() => onStatusTabChange("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
            statusTab === "all"
              ? "bg-primary text-primary-foreground shadow-xs font-semibold"
              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <span>All Recipients</span>
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

        {/* Tapped OK */}
        <button
          onClick={() => onStatusTabChange("Tapped OK")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
            statusTab === "Tapped OK"
              ? "bg-emerald-600 text-white shadow-xs font-semibold"
              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <CheckCheck className="w-3.5 h-3.5" />
          <span>Tapped OK</span>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-4 border-0 ${
              statusTab === "Tapped OK"
                ? "bg-white/20 text-white"
                : "bg-background/80 text-muted-foreground"
            }`}
          >
            {statusCounts.tappedOk}
          </Badge>
        </button>

        {/* Delivered */}
        <button
          onClick={() => onStatusTabChange("Delivered")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
            statusTab === "Delivered"
              ? "bg-blue-600 text-white shadow-xs font-semibold"
              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Delivered</span>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-4 border-0 ${
              statusTab === "Delivered"
                ? "bg-white/20 text-white"
                : "bg-background/80 text-muted-foreground"
            }`}
          >
            {statusCounts.delivered}
          </Badge>
        </button>

        {/* Pending */}
        <button
          onClick={() => onStatusTabChange("Pending")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
            statusTab === "Pending"
              ? "bg-amber-600 text-white shadow-xs font-semibold"
              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pending</span>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-4 border-0 ${
              statusTab === "Pending"
                ? "bg-white/20 text-white"
                : "bg-background/80 text-muted-foreground"
            }`}
          >
            {statusCounts.pending}
          </Badge>
        </button>

        {/* Failed */}
        <button
          onClick={() => onStatusTabChange("Failed")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
            statusTab === "Failed"
              ? "bg-rose-600 text-white shadow-xs font-semibold"
              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Failed</span>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-4 border-0 ${
              statusTab === "Failed"
                ? "bg-white/20 text-white"
                : "bg-background/80 text-muted-foreground"
            }`}
          >
            {statusCounts.failed}
          </Badge>
        </button>
      </div>

      {/* Second Row: Search, Group Select, Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search recipient name, phone, area..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8.5 h-9 text-xs bg-background"
            />
          </div>

          {/* Group Filter Dropdown */}
          <div className="w-[180px]">
            <Select value={selectedGroup} onValueChange={(val) => val && onGroupChange(val)}>
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder="Filter by Group">
                  {(val) => {
                    if (!val || val === "all") return "All Groups & Roles";
                    const labels: Record<string, string> = {
                      candidate: "NDC Candidates",
                      official: "Official Party Agents",
                      extra: "Candidate Extra Agents",
                    };
                    return labels[val] || val;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups & Roles</SelectItem>
                <SelectItem value="candidate">NDC Candidates</SelectItem>
                <SelectItem value="official">Official Party Agents</SelectItem>
                <SelectItem value="extra">Candidate Extra Agents</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset Filters */}
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

        {/* CSV Export */}
        <Button
          variant="outline"
          size="sm"
          onClick={onExportCSV}
          className="h-9 text-xs font-medium gap-1.5 border-border shrink-0 self-end sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV</span>
        </Button>
      </div>
    </div>
  );
}
