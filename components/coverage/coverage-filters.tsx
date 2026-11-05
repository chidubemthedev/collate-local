"use client";

import React from "react";
import { useGeographyStates, useGeographyLgas, useGeographyWards } from "@/lib/hooks/use-geography";
import { Persona } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TableToolbar } from "@/components/ui/table-toolbar";
import { Search, ChevronRight, Lock } from "lucide-react";
import type { CandidateOfficeOption } from "@/types/api";
import { FieldSpinner } from "@/components/ui/field-spinner";

export type CoverageFilterMode = "all" | "gaps" | "gps" | "no-gps";
export type CoverageViewBy = "administrative" | "political";

const FILTER_PILLS: Array<{ mode: CoverageFilterMode; label: string }> = [
  { mode: "all", label: "Show all" },
  { mode: "gaps", label: "Gaps" },
  { mode: "gps", label: "With GPS" },
  { mode: "no-gps", label: "No GPS" },
];

const VIEW_BY_LABELS: Record<CoverageViewBy, string> = {
  administrative: "Administrative Units",
  political: "Political Units",
};

const SORT_LABELS: Record<string, string> = {
  inec: "INEC Code",
  "pus-desc": "Most Polling Units",
  "gaps-desc": "Most Gaps",
  "coverage-asc": "Lowest Coverage",
  "extra-desc": "Most Extra Agents",
};

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s(/.-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

const LABEL_CLASS =
  "text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5";
const TRIGGER_CLASS = "w-full h-8 text-[11px] bg-background";

interface CoverageFiltersProps {
  stateCode: string;
  setStateCode: (code: string) => void;
  lgaCode: string;
  setLgaCode: (code: string) => void;
  wardCode: string;
  setWardCode: (code: string) => void;
  filterMode: CoverageFilterMode;
  setFilterMode: (mode: CoverageFilterMode) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  viewBy: CoverageViewBy;
  setViewBy: (viewBy: CoverageViewBy) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activePersona: Persona;
  onReset: () => void;
  offices: CandidateOfficeOption[];
  officeId: number | null;
  setOfficeId: (id: number | null) => void;
  officesLoading?: boolean;
}

export function CoverageFilters({
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
  viewBy,
  setViewBy,
  searchQuery,
  setSearchQuery,
  activePersona,
  onReset,
  offices,
  officeId,
  setOfficeId,
  officesLoading = false,
}: CoverageFiltersProps) {
  const { data: apiStates = [] } = useGeographyStates();
  const byCode = <T extends { code: string }>(list: T[]) =>
    [...list].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  const statesList = React.useMemo(() => byCode(apiStates), [apiStates]);
  const selectedState = statesList.find((s) => s.code === stateCode || String(s.id) === stateCode);
  const selectedStateId = selectedState ? selectedState.id : null;

  const { data: apiLgas = [], isFetching: lgasLoading } = useGeographyLgas(selectedStateId);
  const availableLGAs = React.useMemo(
    () => (stateCode === "all" ? [] : byCode(apiLgas)),
    [stateCode, apiLgas],
  );
  const selectedLga = availableLGAs.find((l) => l.code === lgaCode || String(l.id) === lgaCode);
  const selectedLgaId = selectedLga ? selectedLga.id : null;

  const { data: apiWards = [], isFetching: wardsLoading } = useGeographyWards(selectedLgaId);
  const availableWards = React.useMemo(
    () => (lgaCode === "all" ? [] : byCode(apiWards)),
    [lgaCode, apiWards],
  );
  const selectedWard = availableWards.find((w) => w.code === wardCode || String(w.id) === wardCode);

  const selectedOffice = offices.find((office) => office.id === officeId);
  const lgaBusy = stateCode !== "all" && lgasLoading;
  const wardBusy = lgaCode !== "all" && wardsLoading;
  const isPolitical = viewBy === "political";

  const stateField = (
    <div className="space-y-1">
      <label className={`${LABEL_CLASS} justify-between`}>
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
        <SelectTrigger className={TRIGGER_CLASS}>
          <SelectValue placeholder="All States">
            {(val) => {
              if (!val || val === "all") return "All States";
              const found = statesList.find((s) => s.code === val || String(s.id) === val);
              return found ? `${found.code} · ${titleCase(found.name)}` : val;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All States</SelectItem>
          {statesList.map((st) => (
            <SelectItem key={st.code} value={st.code}>
              {st.code} · {titleCase(st.name)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const lgaField = (
    <div className="space-y-1">
      <label className={`${LABEL_CLASS} justify-between`}>
        <span className="flex items-center gap-1.5">
          LGA
          <FieldSpinner loading={lgaBusy} />
        </span>
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
        disabled={stateCode === "all" || !activePersona.canFilterByLGA || lgaBusy}
      >
        <SelectTrigger className={TRIGGER_CLASS}>
          <SelectValue placeholder="All LGAs">
            {(val) => {
              if (lgaBusy) return "Loading LGAs…";
              if (!val || val === "all") return "All LGAs";
              const found = availableLGAs.find((l) => l.code === val || String(l.id) === val);
              return found ? `${found.code} · ${titleCase(found.name)}` : val;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All LGAs</SelectItem>
          {availableLGAs.map((lga) => (
            <SelectItem key={lga.code} value={lga.code}>
              {lga.code} · {titleCase(lga.name)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const wardField = (
    <div className="space-y-1">
      <label className={LABEL_CLASS}>
        Ward / area
        <FieldSpinner loading={wardBusy} />
      </label>
      <Select
        value={wardCode}
        onValueChange={(val) => {
          if (val) setWardCode(val);
        }}
        disabled={lgaCode === "all" || wardBusy}
      >
        <SelectTrigger className={TRIGGER_CLASS}>
          <SelectValue placeholder="All Wards">
            {(val) => {
              if (wardBusy) return "Loading wards…";
              if (!val || val === "all") return "All Wards";
              const found = availableWards.find((w) => w.code === val || String(w.id) === val);
              return found ? `${found.code} · ${titleCase(found.name)}` : val;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Wards</SelectItem>
          {availableWards.map((w) => (
            <SelectItem key={w.code} value={w.code}>
              {w.code} · {titleCase(w.name)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const officeField = (
    <div className="space-y-1">
      <label className={LABEL_CLASS}>
        Office
        <FieldSpinner loading={officesLoading} />
      </label>
      <Select
        value={officeId === null ? "all" : String(officeId)}
        onValueChange={(val) => setOfficeId(val && val !== "all" ? Number(val) : null)}
        disabled={offices.length === 0 || officesLoading}
      >
        <SelectTrigger className={TRIGGER_CLASS}>
          <SelectValue placeholder="All Offices">
            {() => (officesLoading ? "Loading offices…" : selectedOffice ? titleCase(selectedOffice.name) : "All Offices")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Offices</SelectItem>
          {offices.map((office) => (
            <SelectItem key={office.id} value={String(office.id)}>
              {titleCase(office.name)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const sortField = (
    <div className="space-y-1">
      <label className={LABEL_CLASS}>Sort order</label>
      <Select
        value={sortBy}
        onValueChange={(val) => {
          if (val) setSortBy(val);
        }}
      >
        <SelectTrigger className={TRIGGER_CLASS}>
          <SelectValue placeholder="INEC Code">{(val) => SORT_LABELS[val ?? ""] ?? "INEC Code"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 text-[11px] overflow-x-auto py-1 text-muted-foreground scrollbar-none">
          <button
            onClick={() => {
              if (!activePersona.stateCode) setStateCode("all");
              setLgaCode("all");
              setWardCode("all");
            }}
            className="text-xs font-semibold text-foreground hover:text-primary hover:underline flex items-center gap-1 shrink-0"
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

      <TableToolbar
        inlineMobile
        onClear={onReset}
        activeFilters={[
          ...(stateCode !== "all" ? [{ id: "state", label: `State: ${selectedState?.name ?? stateCode}`, onRemove: () => { setStateCode(activePersona.stateCode || "all"); setLgaCode("all"); setWardCode("all"); } }] : []),
          ...(lgaCode !== "all" ? [{ id: "lga", label: `LGA: ${selectedLga?.name ?? lgaCode}`, onRemove: () => { setLgaCode("all"); setWardCode("all"); } }] : []),
          ...(wardCode !== "all" ? [{ id: "ward", label: `Ward: ${selectedWard?.name ?? wardCode}`, onRemove: () => setWardCode("all") }] : []),
          ...(officeId !== null ? [{ id: "office", label: `Office: ${selectedOffice?.name ?? "Selected"}`, onRemove: () => setOfficeId(null) }] : []),
          ...(searchQuery ? [{ id: "search", label: `Search: ${searchQuery}`, onRemove: () => setSearchQuery("") }] : []),
          ...(filterMode !== "all" ? [{ id: "coverage", label: `Show: ${FILTER_PILLS.find((p) => p.mode === filterMode)?.label ?? filterMode}`, onRemove: () => setFilterMode("all") }] : []),
        ]}
      >
        <div className="w-full space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3 items-end">
            <div className="space-y-1">
              <label className={LABEL_CLASS}>Search</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Unit, ward, LGA or code"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-[11px] bg-background w-full"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className={LABEL_CLASS}>View by</label>
              <Select
                value={viewBy}
                onValueChange={(val) => {
                  if (val === "administrative" || val === "political") setViewBy(val);
                }}
              >
                <SelectTrigger className={TRIGGER_CLASS}>
                  <SelectValue placeholder="Administrative Units">
                    {(val) => VIEW_BY_LABELS[val as CoverageViewBy] ?? "Administrative Units"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrative">Administrative Units</SelectItem>
                  <SelectItem value="political">Political Units</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {stateField}
            {isPolitical && officeField}
            {lgaField}
            {wardField}
            {sortField}
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 text-[11px]">
            {FILTER_PILLS.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilterMode(mode)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                  filterMode === mode
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </TableToolbar>
    </div>
  );
}
