"use client";

import React from "react";
import { STATES_DATA, LGAS_DATA, WARDS_DATA } from "@/lib/data/inec-data";
import { useGeographyStates, useGeographyLgas, useGeographyWards } from "@/lib/hooks/use-geography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  const statesList = apiStates.length > 0 ? apiStates : STATES_DATA;
  const foundState = statesList.find(
    (s) => s.code === selectedState || ("id" in s && String(s.id) === selectedState)
  );
  const selectedStateId = foundState && "id" in foundState ? (foundState.id as number) : null;

  const { data: apiLgas = [] } = useGeographyLgas(selectedStateId);
  const availableLGAs =
    selectedState === "all"
      ? []
      : apiLgas.length > 0
      ? apiLgas
      : LGAS_DATA.filter((l) => l.stateCode === selectedState);
  const foundLga = availableLGAs.find(
    (l) => l.code === selectedLga || ("id" in l && String(l.id) === selectedLga)
  );
  const selectedLgaId = foundLga && "id" in foundLga ? (foundLga.id as number) : null;

  const { data: apiWards = [] } = useGeographyWards(selectedLgaId);
  const availableWards =
    selectedLga === "all"
      ? []
      : apiWards.length > 0
      ? apiWards
      : WARDS_DATA.filter((w) => w.lgaCode === selectedLga);

  const tabs = [
    { id: "all", label: "All Records", count: counts.all, icon: Users },
    { id: "official", label: "Official Party Agents", count: counts.official, icon: ShieldCheck },
    { id: "extra", label: "Candidate Extra Agents", count: counts.extra, icon: Users },
    { id: "gaps", label: "Gaps (Uncovered PUs)", count: counts.gaps, icon: AlertCircle },
  ];

  return (
    <div className="bg-card border border-border/80 rounded-xl p-3 sm:p-4 shadow-sm space-y-3">
      {/* Top Bar: Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border/60">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = selectedTypeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTypeTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
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

      {/* Main Filter Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* State Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
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
            <SelectTrigger className="h-8.5 text-xs bg-background">
              <SelectValue placeholder="All States" />
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
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            LGA
          </label>
          <Select
            value={selectedLga}
            onValueChange={(val) => {
              if (val) {
                setSelectedLga(val);
                setSelectedWard("all");
              }
            }}
            disabled={selectedState === "all"}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background">
              <SelectValue placeholder={selectedState === "all" ? "Select state" : "All LGAs"} />
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
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Ward
          </label>
          <Select
            value={selectedWard}
            onValueChange={(val) => {
              if (val) setSelectedWard(val);
            }}
            disabled={selectedLga === "all"}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background">
              <SelectValue placeholder={selectedLga === "all" ? "Select LGA" : "All Wards"} />
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
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Sponsor
          </label>
          <Select
            value={selectedSponsor}
            onValueChange={(val) => {
              if (val) setSelectedSponsor(val);
            }}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background">
              <SelectValue placeholder="All Sponsors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sponsors</SelectItem>
              <SelectItem value="Party">Party Official</SelectItem>
              <SelectItem value="President">Presidency (Obi Peter Gregory)</SelectItem>
              <SelectItem value="Senate">Senate (Nwoye Tony)</SelectItem>
              <SelectItem value="House of Reps">Reps (Emeka Idu)</SelectItem>
              <SelectItem value="State Assembly">State Assembly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Role Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Role
          </label>
          <Select
            value={selectedRole}
            onValueChange={(val) => {
              if (val) setSelectedRole(val);
            }}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background">
              <SelectValue placeholder="All Roles" />
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
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Search
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Name or PU code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8.5 text-xs bg-background"
            />
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            Showing <strong className="text-foreground">{totalFilteredCount}</strong> record{totalFilteredCount !== 1 ? "s" : ""}
          </span>
          {(selectedState !== "all" ||
            selectedLga !== "all" ||
            selectedWard !== "all" ||
            selectedSponsor !== "all" ||
            selectedRole !== "all" ||
            selectedChannel !== "all" ||
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
            <span>Export Roster (CSV)</span>
          </Button>

          <Link
            href="/broadcasts/new?group=agents"
            className="inline-flex items-center justify-center rounded-lg text-xs font-medium h-7.5 px-3 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Broadcast to Agents</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
