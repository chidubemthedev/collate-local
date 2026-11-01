"use client";

import React from "react";
import { STATES_DATA, LGAS_DATA, WARDS_DATA } from "@/lib/data/inec-data";
import { useGeographyStates, useGeographyLgas, useGeographyWards } from "@/lib/hooks/use-geography";
import { Persona } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Filter, RotateCcw, ChevronRight, Lock, MapPin, Layers, Building2 } from "lucide-react";

interface CoverageFiltersProps {
  unitMode: "administrative" | "political";
  setUnitMode: (mode: "administrative" | "political") => void;
  stateCode: string;
  setStateCode: (code: string) => void;
  lgaCode: string;
  setLgaCode: (code: string) => void;
  wardCode: string;
  setWardCode: (code: string) => void;
  filterMode: "all" | "gaps";
  setFilterMode: (mode: "all" | "gaps") => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activePersona: Persona;
  totalPUsCount: number;
  gapsCount: number;
  onReset: () => void;
}

export function CoverageFilters({
  unitMode,
  setUnitMode,
  stateCode,
  setStateCode,
  lgaCode,
  setLgaCode,
  wardCode,
  setWardCode,
  filterMode,
  setFilterMode,
  sortBy,
  setSortBy,
  searchQuery,
  setSearchQuery,
  activePersona,
  totalPUsCount,
  gapsCount,
  onReset,
}: CoverageFiltersProps) {
  // Fetch live geography data
  const { data: apiStates = [] } = useGeographyStates();
  const statesList = apiStates.length > 0 ? apiStates : STATES_DATA;
  const selectedState = statesList.find(
    (s) => s.code === stateCode || ("id" in s && String(s.id) === stateCode)
  );
  const selectedStateId = selectedState && "id" in selectedState ? (selectedState.id as number) : null;

  const { data: apiLgas = [] } = useGeographyLgas(selectedStateId);
  const availableLGAs =
    stateCode === "all"
      ? []
      : apiLgas.length > 0
      ? apiLgas
      : LGAS_DATA.filter((l) => l.stateCode === stateCode);
  const selectedLga = availableLGAs.find(
    (l) => l.code === lgaCode || ("id" in l && String(l.id) === lgaCode)
  );
  const selectedLgaId = selectedLga && "id" in selectedLga ? (selectedLga.id as number) : null;

  const { data: apiWards = [] } = useGeographyWards(selectedLgaId);
  const availableWards =
    lgaCode === "all"
      ? []
      : apiWards.length > 0
      ? apiWards
      : WARDS_DATA.filter((w) => w.lgaCode === lgaCode);
  const selectedWard = availableWards.find(
    (w) => w.code === wardCode || ("id" in w && String(w.id) === wardCode)
  );

  return (
    <div className="space-y-3 bg-card border border-border/80 rounded-xl p-3 sm:p-4 shadow-sm">
      {/* Top row: Unit mode tabs & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border/60">
        {/* Unit Mode Toggle */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-lg w-fit">
          <button
            onClick={() => setUnitMode("administrative")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              unitMode === "administrative"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-primary" />
            Administrative units
          </button>
          <button
            onClick={() => setUnitMode("political")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              unitMode === "political"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            Political units
          </button>
        </div>

        {/* Dynamic Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-xs overflow-x-auto py-1 text-muted-foreground scrollbar-none">
          <button
            onClick={() => {
              if (!activePersona.stateCode) setStateCode("all");
              setLgaCode("all");
              setWardCode("all");
            }}
            className="hover:text-primary font-medium hover:underline flex items-center gap-1 shrink-0"
          >
            Nigeria
          </button>

          {stateCode !== "all" && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
              <button
                onClick={() => {
                  setLgaCode("all");
                  setWardCode("all");
                }}
                className={`hover:text-primary font-medium hover:underline shrink-0 ${
                  lgaCode === "all" ? "text-foreground font-semibold" : ""
                }`}
              >
                {selectedState?.name || stateCode} ({stateCode})
              </button>
            </>
          )}

          {lgaCode !== "all" && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
              <button
                onClick={() => setWardCode("all")}
                className={`hover:text-primary font-medium hover:underline shrink-0 ${
                  wardCode === "all" ? "text-foreground font-semibold" : ""
                }`}
              >
                {selectedLga?.name || lgaCode} ({lgaCode})
              </button>
            </>
          )}

          {wardCode !== "all" && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
              <span className="text-foreground font-semibold shrink-0">
                {selectedWard?.name || wardCode} ({wardCode})
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main Filter Controls Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5 items-center">
        {/* State Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>State</span>
            {activePersona.stateCode && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 gap-0.5 text-amber-700 bg-amber-50 dark:bg-amber-950/40">
                <Lock className="w-2 h-2" /> Scoped
              </Badge>
            )}
          </label>
          <Select
            value={stateCode}
            onValueChange={(val) => {
              if (val) {
                setStateCode(val);
                setLgaCode("all");
                setWardCode("all");
              }
            }}
            disabled={!!activePersona.stateCode}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background">
              <SelectValue placeholder="All States" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States ({statesList.length})</SelectItem>
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
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>LGA</span>
            {!activePersona.canFilterByLGA && (
              <Tooltip>
                <TooltipTrigger>
                  <span className="text-[9px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> Locked
                  </span>
                </TooltipTrigger>
                <TooltipContent className="text-xs max-w-xs">
                  Candidates cannot filter by single LGA since constituency may span across multiple LGAs or sub-units.
                </TooltipContent>
              </Tooltip>
            )}
          </label>
          <Select
            value={lgaCode}
            onValueChange={(val) => {
              if (val) {
                setLgaCode(val);
                setWardCode("all");
              }
            }}
            disabled={stateCode === "all" || !activePersona.canFilterByLGA}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background">
              <SelectValue placeholder={stateCode === "all" ? "Select State first" : "All LGAs"} />
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
            Ward / Area
          </label>
          <Select
            value={wardCode}
            onValueChange={(val) => {
              if (val) setWardCode(val);
            }}
            disabled={lgaCode === "all"}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background">
              <SelectValue placeholder={lgaCode === "all" ? "Select LGA first" : "All Wards"} />
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

        {/* Sort selector */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Sort Order
          </label>
          <Select
            value={sortBy}
            onValueChange={(val) => {
              if (val) setSortBy(val);
            }}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pus-desc">PUs (high to low)</SelectItem>
              <SelectItem value="pus-asc">PUs (low to high)</SelectItem>
              <SelectItem value="coverage-desc">Coverage % (high to low)</SelectItem>
              <SelectItem value="coverage-asc">Coverage % (low to high)</SelectItem>
              <SelectItem value="name-asc">Name (A to Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Search Input */}
        <div className="space-y-1 sm:col-span-2 md:col-span-4 lg:col-span-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Search
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8.5 text-xs bg-background"
            />
          </div>
        </div>
      </div>

      {/* Bottom Filter Toggle Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterMode("all")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              filterMode === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Show all ({totalPUsCount.toLocaleString()})
          </button>
          <button
            onClick={() => setFilterMode("gaps")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterMode === "gaps"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Gaps (no agent) ({gapsCount.toLocaleString()})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {(stateCode !== "all" || lgaCode !== "all" || wardCode !== "all" || searchQuery || filterMode !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
            >
              <RotateCcw className="w-3 h-3" />
              Reset filters
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
