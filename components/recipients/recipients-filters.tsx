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
import { STATES_DATA, LGAS_DATA } from "@/lib/data/inec-data";
import { TableToolbar } from "@/components/ui/table-toolbar";
import {
  Search,
  Plus,
  Upload,
  Download,
  RotateCcw,
  Bot,
  Smartphone,
  AlertCircle,
  Users,
} from "lucide-react";

interface StatusCounts {
  all: number;
  telegramConnected: number;
  smsOnly: number;
  notMatched: number;
}

interface RecipientsFiltersProps {
  statusTab: string;
  onStatusTabChange: (tab: string) => void;
  statusCounts: StatusCounts;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedGroup: string;
  onGroupChange: (group: string) => void;
  selectedState: string;
  onStateChange: (state: string) => void;
  selectedLga: string;
  onLgaChange: (lga: string) => void;
  selectedSource: string;
  onSourceChange: (source: string) => void;
  onReset: () => void;
  isFiltered: boolean;
  onExportCSV: () => void;
}

export function RecipientsFilters({
  statusTab,
  onStatusTabChange,
  statusCounts,
  searchQuery,
  onSearchChange,
  selectedGroup,
  onGroupChange,
  selectedState,
  onStateChange,
  selectedLga,
  onLgaChange,
  selectedSource,
  onSourceChange,
  onReset,
  onExportCSV,
}: RecipientsFiltersProps) {
  const availableLgas = LGAS_DATA.filter(
    (l) => selectedState === "all" || l.stateCode === selectedState,
  );

  return (
    <div className="space-y-4">
      {/* Top Bar: Channel Status Tabs + Action CTAs */}
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
            <span>All Personnel</span>
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
            onClick={() => onStatusTabChange("Telegram connected")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusTab === "Telegram connected"
                ? "bg-emerald-600 text-white shadow-xs font-semibold"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Telegram Connected</span>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 border-0 ${
                statusTab === "Telegram connected"
                  ? "bg-white/20 text-white"
                  : "bg-background/80 text-muted-foreground"
              }`}
            >
              {statusCounts.telegramConnected}
            </Badge>
          </button>

          <button
            onClick={() => onStatusTabChange("SMS only")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusTab === "SMS only"
                ? "bg-blue-600 text-white shadow-xs font-semibold"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>SMS Fallback</span>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 border-0 ${
                statusTab === "SMS only"
                  ? "bg-white/20 text-white"
                  : "bg-background/80 text-muted-foreground"
              }`}
            >
              {statusCounts.smsOnly}
            </Badge>
          </button>

          <button
            onClick={() => onStatusTabChange("Number not matched")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusTab === "Number not matched"
                ? "bg-amber-600 text-white shadow-xs font-semibold"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Not Matched</span>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 border-0 ${
                statusTab === "Number not matched"
                  ? "bg-white/20 text-white"
                  : "bg-background/80 text-muted-foreground"
              }`}
            >
              {statusCounts.notMatched}
            </Badge>
          </button>
        </div>

      </div>

      <TableToolbar
        onClear={onReset}
        activeFilters={[
          ...(statusTab !== "all" ? [{ id: "status", label: `Status: ${statusTab}`, onRemove: () => onStatusTabChange("all") }] : []),
          ...(searchQuery ? [{ id: "search", label: `Search: ${searchQuery}`, onRemove: () => onSearchChange("") }] : []),
          ...(selectedGroup !== "all" ? [{ id: "group", label: `Role: ${selectedGroup}`, onRemove: () => onGroupChange("all") }] : []),
          ...(selectedState !== "all" ? [{ id: "state", label: `State: ${STATES_DATA.find((state) => state.code === selectedState)?.name ?? selectedState}`, onRemove: () => { onStateChange("all"); onLgaChange("all"); } }] : []),
          ...(selectedLga !== "all" ? [{ id: "lga", label: `LGA: ${availableLgas.find((lga) => lga.code === selectedLga)?.name ?? selectedLga}`, onRemove: () => onLgaChange("all") }] : []),
          ...(selectedSource !== "all" ? [{ id: "source", label: `Source: ${selectedSource}`, onRemove: () => onSourceChange("all") }] : []),
        ]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled
              title="Not unavailable yet"
              className="h-9 text-xs font-medium gap-1.5 border-border"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import CSV: Unavailable</span>
            </Button>
            <Button
              size="sm"
              disabled
              title="Not available yet"
              className="h-9 text-xs font-semibold gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Recipient: Unavailable</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onExportCSV}
              className="h-9 text-xs font-medium gap-1.5 border-border shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </>
        }
      >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, phone, PU, or source..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8.5 h-9 text-xs bg-background"
            />
          </div>

          {/* Group / Role Dropdown */}
          <div className="w-[160px]">
            <Select
              value={selectedGroup}
              onValueChange={(v) => v && onGroupChange(v)}
            >
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder="Filter Role">
                  {(val) => {
                    if (!val || val === "all") return "All Roles";
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
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="candidate">NDC Candidates</SelectItem>
                <SelectItem value="official">Official Party Agents</SelectItem>
                <SelectItem value="extra">Candidate Extra Agents</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* State Dropdown */}
          <div className="w-[140px]">
            <Select
              value={selectedState}
              onValueChange={(v) => v && onStateChange(v)}
            >
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder="State">
                  {(val) => {
                    if (!val || val === "all") return "All States";
                    const found = STATES_DATA.find((s) => s.code === val);
                    return found ? `${found.code} · ${found.name}` : val;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {STATES_DATA.map((st) => (
                  <SelectItem key={st.code} value={st.code}>
                    {st.code} · {st.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* LGA Dropdown */}
          <div className="w-[150px]">
            <Select
              value={selectedLga}
              onValueChange={(v) => v && onLgaChange(v)}
            >
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder="LGA">
                  {(val) => {
                    if (!val || val === "all") return "All LGAs";
                    const found = availableLgas.find((l) => l.code === val);
                    return found ? `${found.code} · ${found.name}` : val;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All LGAs</SelectItem>
                {availableLgas.map((lga) => (
                  <SelectItem key={lga.code} value={lga.code}>
                    {lga.code} · {lga.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>

      </div>
      </TableToolbar>
    </div>
  );
}
