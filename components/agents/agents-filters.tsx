"use client";

import React from "react";
import { useGeographyStates, useGeographyLgas, useGeographyWards } from "@/lib/hooks/use-geography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TableToolbar } from "@/components/ui/table-toolbar";
import { FieldSpinner } from "@/components/ui/field-spinner";
import {
  Search,
  Filter,
  RotateCcw,
  Download,
  Send,
  ShieldCheck,
  Users,
  AlertCircle,
  Building,
} from "lucide-react";
import Link from "next/link";

interface AgentsFiltersProps {
  selectedTypeTab: "all" | "official" | "extra" | "gaps";
  setSelectedTypeTab: (tab: "all" | "official" | "extra" | "gaps") => void;
  selectedState: string;
  setSelectedState: (state: string) => void;
  selectedLga: string;
  setSelectedLga: (lga: string) => void;
  selectedWard: string;
  setSelectedWard: (ward: string) => void;
  selectedSponsor: string;
  setSelectedSponsor: (sponsor: string) => void;
  selectedRole: string;
  setSelectedRole: (role: string) => void;
  selectedChannel: string;
  setSelectedChannel: (channel: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  totalFilteredCount: number;
  counts: {
    all: number;
    official: number;
    extra: number;
    gaps: number;
  };
  onReset: () => void;
  onExportCSV: () => void;
}

export function AgentsFilters({
  selectedTypeTab,
  setSelectedTypeTab,
  selectedState,
  setSelectedState,
  selectedLga,
  setSelectedLga,
  selectedWard,
  setSelectedWard,
  selectedSponsor,
  setSelectedSponsor,
  selectedRole,
  setSelectedRole,
  selectedChannel,
  setSelectedChannel,
  searchQuery,
  setSearchQuery,
  totalFilteredCount,
  counts,
  onReset,
  onExportCSV,
}: AgentsFiltersProps) {
  const { data: apiStates = [] } = useGeographyStates();
  const statesList = apiStates;
  const foundState = statesList.find(
    (s) => s.code === selectedState || String(s.id) === selectedState
  );
  const selectedStateId = foundState ? foundState.id : null;

  const { data: apiLgas = [], isFetching: lgasFetching } = useGeographyLgas(selectedStateId);
  const availableLGAs = selectedState === "all" ? [] : apiLgas;
  const foundLga = availableLGAs.find(
    (l) => l.code === selectedLga || String(l.id) === selectedLga
  );
  const selectedLgaId = foundLga ? foundLga.id : null;

  const { data: apiWards = [], isFetching: wardsFetching } = useGeographyWards(selectedLgaId);
  const availableWards = selectedLga === "all" ? [] : apiWards;
  const lgaBusy = selectedState !== "all" && lgasFetching;
  const wardBusy = selectedLga !== "all" && wardsFetching;

  const tabs: Array<{
    id: AgentsFiltersProps["selectedTypeTab"];
    label: string;
    count: number;
    icon: typeof Users;
  }> = [
    { id: "all", label: "All Records", count: counts.all, icon: Users },
    { id: "official", label: "Official Party Agents", count: counts.official, icon: ShieldCheck },
    { id: "extra", label: "Candidate Extra Agents", count: counts.extra, icon: Users },
    { id: "gaps", label: "Gaps (Uncovered PUs)", count: counts.gaps, icon: AlertCircle },
  ];

  return (
    <div className="space-y-3">
      {/* Top Bar: Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border/60">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = selectedTypeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTypeTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-background text-muted-foreground"
                  }`}
                >
                  {tab.count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <TableToolbar
        onClear={onReset}
        activeFilters={[
          ...(selectedState !== "all" ? [{ id: "state", label: `State: ${foundState?.name ?? selectedState}`, onRemove: () => { setSelectedState("all"); setSelectedLga("all"); setSelectedWard("all"); } }] : []),
          ...(selectedLga !== "all" ? [{ id: "lga", label: `LGA: ${foundLga?.name ?? selectedLga}`, onRemove: () => { setSelectedLga("all"); setSelectedWard("all"); } }] : []),
          ...(selectedWard !== "all" ? [{ id: "ward", label: `Ward: ${availableWards.find((ward) => ward.code === selectedWard || String(ward.id) === selectedWard)?.name ?? selectedWard}`, onRemove: () => setSelectedWard("all") }] : []),
          ...(selectedSponsor !== "all" ? [{ id: "sponsor", label: `Sponsor: ${selectedSponsor}`, onRemove: () => setSelectedSponsor("all") }] : []),
          ...(selectedRole !== "all" ? [{ id: "role", label: `Role: ${selectedRole}`, onRemove: () => setSelectedRole("all") }] : []),
          ...(selectedChannel !== "all" ? [{ id: "channel", label: `Channel: ${selectedChannel}`, onRemove: () => setSelectedChannel("all") }] : []),
          ...(searchQuery ? [{ id: "search", label: `Search: ${searchQuery}`, onRemove: () => setSearchQuery("") }] : []),
          ...(selectedTypeTab !== "all" ? [{ id: "type", label: `Type: ${selectedTypeTab}`, onRemove: () => setSelectedTypeTab("all") }] : []),
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
              <span>Export Roster (CSV)</span>
            </Button>
            <Link
              href="/broadcasts/new?group=agents"
              className="inline-flex items-center justify-center rounded-lg text-xs font-medium h-7.5 px-3 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Broadcast to Agents</span>
            </Link>
          </>
        }
      >
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* State Filter */}
        <div className="space-y-1 min-w-0 w-full">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block truncate">
            State
          </label>
          <Select
            value={selectedState}
            onValueChange={(val) => {
              if (val) {
                setSelectedState(val);
                setSelectedLga("all");
                setSelectedWard("all");
              }
            }}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background w-full">
              <SelectValue placeholder="All States">
                {(val) => {
                  if (!val || val === "all") return "All States";
                  const found = statesList.find((s) => s.code === val || String(s.id) === val);
                  return found ? found.name : val;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {statesList.map((st) => (
                <SelectItem key={st.code} value={st.code}>
                  {st.name} ({st.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* LGA Filter */}
        <div className="space-y-1 min-w-0 w-full">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 truncate">
            LGA
            <FieldSpinner loading={lgaBusy} />
          </label>
          <Select
            value={selectedLga}
            onValueChange={(val) => {
              if (val) {
                setSelectedLga(val);
                setSelectedWard("all");
              }
            }}
            disabled={selectedState === "all" || lgaBusy}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background w-full">
              <SelectValue placeholder={selectedState === "all" ? "Select state" : "All LGAs"}>
                {(val) => {
                  if (lgaBusy) return "Loading LGAs…";
                  if (!val || val === "all") return selectedState === "all" ? "Select state" : "All LGAs";
                  const found = availableLGAs.find((l) => l.code === val || String(l.id) === val);
                  return found ? found.name : val;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All LGAs ({availableLGAs.length})</SelectItem>
              {availableLGAs.map((lga) => (
                <SelectItem key={lga.code} value={lga.code}>
                  {lga.name} ({lga.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ward Filter */}
        <div className="space-y-1 min-w-0 w-full">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 truncate">
            Ward
            <FieldSpinner loading={wardBusy} />
          </label>
          <Select
            value={selectedWard}
            onValueChange={(val) => {
              if (val) setSelectedWard(val);
            }}
            disabled={selectedLga === "all" || wardBusy}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background w-full">
              <SelectValue placeholder={selectedLga === "all" ? "Select LGA" : "All Wards"}>
                {(val) => {
                  if (wardBusy) return "Loading wards…";
                  if (!val || val === "all") return selectedLga === "all" ? "Select LGA" : "All Wards";
                  const found = availableWards.find((w) => w.code === val || String(w.id) === val);
                  return found ? found.name : val;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Wards ({availableWards.length})</SelectItem>
              {availableWards.map((w) => (
                <SelectItem key={w.code} value={w.code}>
                  {w.name} ({w.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sponsor Filter */}
        <div className="space-y-1 min-w-0 w-full">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block truncate">
            Sponsor
          </label>
          <Select
            value={selectedSponsor}
            onValueChange={(val) => {
              if (val) setSelectedSponsor(val);
            }}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background w-full">
              <SelectValue placeholder="All Sponsors">
                {(val) => {
                  if (!val || val === "all") return "All Sponsors";
                  const labels: Record<string, string> = {
                    Party: "Party Official",
                    President: "Presidency",
                    Senate: "Senate",
                    "House of Reps": "House of Reps",
                    "State Assembly": "State Assembly",
                  };
                  return labels[val] || val;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sponsors</SelectItem>
              <SelectItem value="Party">Party Official</SelectItem>
              <SelectItem value="President">Presidency</SelectItem>
              <SelectItem value="Senate">Senate</SelectItem>
              <SelectItem value="House of Reps">House of Reps</SelectItem>
              <SelectItem value="State Assembly">State Assembly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Role Filter */}
        <div className="space-y-1 min-w-0 w-full">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block truncate">
            Role
          </label>
          <Select
            value={selectedRole}
            onValueChange={(val) => {
              if (val) setSelectedRole(val);
            }}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background w-full">
              <SelectValue placeholder="All Roles">
                {(val) => {
                  if (!val || val === "all") return "All Roles";
                  const labels: Record<string, string> = {
                    "Official Party Agent": "Official Party Agent",
                    Protector: "Protector (Ballot Guard)",
                    Mobiliser: "Mobiliser (Turnout)",
                    Snapper: "Snapper (EC8A Photos)",
                  };
                  return labels[val] || val;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="Official Party Agent">Official Party Agent</SelectItem>
              <SelectItem value="Protector">Protector (Ballot Guard)</SelectItem>
              <SelectItem value="Mobiliser">Mobiliser (Turnout)</SelectItem>
              <SelectItem value="Snapper">Snapper (EC8A Photos)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="order-first space-y-1 min-w-0 w-full">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block truncate">
            Search
          </label>
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Name or PU code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8.5 text-xs bg-background w-full"
            />
          </div>
        </div>
      </div>
      </TableToolbar>
      <p className="text-xs text-muted-foreground">
        Showing <strong className="text-foreground">{totalFilteredCount}</strong> record{totalFilteredCount !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
