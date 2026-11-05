"use client";

import React from "react";
import {
  useGeographyStates,
  useGeographyLgas,
  useGeographyWards,
} from "@/lib/hooks/use-geography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldSpinner } from "@/components/ui/field-spinner";
import { TableToolbar, type ActiveTableFilter } from "@/components/ui/table-toolbar";

export type CandidateRoleFilter = "all" | "running_mates";
export type CandidateSortOrder =
  | "office"
  | "state"
  | "candidate"
  | "seat"
  | "coverage_desc"
  | "coverage_asc"
  | "extra_desc";

export const CHANNEL_OPTIONS = [
  { value: "all", label: "Any status" },
  { value: "connected", label: "Connected" },
  { value: "sms_only", label: "Invited" },
  { value: "not_matched", label: "Not connected" },
] as const;

export const COVERAGE_TIER_OPTIONS = [
  { value: "all", label: "Any tier" },
  { value: "high", label: "High (50% and above)" },
  { value: "medium", label: "Medium (30–49%)" },
  { value: "critical", label: "Critical (below 30%)" },
  { value: "unmapped", label: "Seat area not mapped" },
] as const;

export const ROLE_OPTIONS = [
  { value: "all", label: "Candidates + running mates" },
  { value: "running_mates", label: "Running mates only" },
] as const;

export const SORT_OPTIONS = [
  { value: "office", label: "Office, then state" },
  { value: "state", label: "State A–Z" },
  { value: "candidate", label: "Candidate A–Z" },
  { value: "seat", label: "Seat A–Z" },
  { value: "coverage_desc", label: "Coverage: highest first" },
  { value: "coverage_asc", label: "Coverage: lowest first" },
  { value: "extra_desc", label: "Extra agents: most first" },
] as const;

// INEC names come in upper case (e.g. "AKWA IBOM"); show them as "Akwa Ibom", keeping FCT as is.
export function toTitleCase(name: string) {
  return name
    .toLowerCase()
    .replace(/(^|[\s\-'(/])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\bFct\b/g, "FCT");
}

function labelFor(options: ReadonlyArray<{ value: string; label: string }>, value: string | null) {
  return options.find((option) => option.value === value)?.label ?? options[0].label;
}

interface CandidatesFiltersProps {
  selectedOffice: string;
  setSelectedOffice: (office: string) => void;
  officeCounts: Record<string, number>;
  /** "all" or the state / LGA / ward id as a string. */
  selectedStateId: string;
  setSelectedStateId: (id: string) => void;
  selectedLgaId: string;
  setSelectedLgaId: (id: string) => void;
  selectedWardId: string;
  setSelectedWardId: (id: string) => void;
  selectedChannel: string;
  setSelectedChannel: (channel: string) => void;
  selectedCoverageTier: string;
  setSelectedCoverageTier: (tier: string) => void;
  selectedRole: CandidateRoleFilter;
  setSelectedRole: (role: CandidateRoleFilter) => void;
  sortOrder: CandidateSortOrder;
  setSortOrder: (order: CandidateSortOrder) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  totalCount: number;
  /** The list is refetching after a filter change. */
  isRefreshing?: boolean;
  onReset: () => void;
}

const LABEL_CLASS =
  "flex items-center gap-1.5 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground";
const TRIGGER_CLASS = "h-8 w-full bg-background text-xs data-[disabled]:bg-muted data-[disabled]:opacity-70";

export function CandidatesFilters({
  selectedOffice,
  setSelectedOffice,
  officeCounts,
  selectedStateId,
  setSelectedStateId,
  selectedLgaId,
  setSelectedLgaId,
  selectedWardId,
  setSelectedWardId,
  selectedChannel,
  setSelectedChannel,
  selectedCoverageTier,
  setSelectedCoverageTier,
  selectedRole,
  setSelectedRole,
  sortOrder,
  setSortOrder,
  searchQuery,
  setSearchQuery,
  totalCount,
  isRefreshing = false,
  onReset,
}: CandidatesFiltersProps) {
  const statesQuery = useGeographyStates();
  const states = statesQuery.data ?? [];
  const lgasQuery = useGeographyLgas(selectedStateId === "all" ? null : selectedStateId);
  const lgas = selectedStateId === "all" ? [] : lgasQuery.data ?? [];
  const wardsQuery = useGeographyWards(selectedLgaId === "all" ? null : selectedLgaId);
  const wards = selectedLgaId === "all" ? [] : wardsQuery.data ?? [];
  const statesBusy = statesQuery.isPending;
  const lgasBusy = selectedStateId !== "all" && lgasQuery.isFetching;
  const wardsBusy = selectedLgaId !== "all" && wardsQuery.isFetching;

  const foundState = states.find((item) => String(item.id) === selectedStateId);
  const foundLga = lgas.find((item) => String(item.id) === selectedLgaId);
  const foundWard = wards.find((item) => String(item.id) === selectedWardId);

  // Sort order is not a filter, so it gets no chip.
  const activeFilters: ActiveTableFilter[] = [
    ...(searchQuery.trim()
      ? [{ id: "search", label: `Search: ${searchQuery.trim()}`, onRemove: () => setSearchQuery("") }]
      : []),
    ...(selectedStateId !== "all"
      ? [{
          id: "state",
          label: `State: ${foundState ? toTitleCase(foundState.name) : selectedStateId}`,
          onRemove: () => {
            setSelectedStateId("all");
            setSelectedLgaId("all");
            setSelectedWardId("all");
          },
        }]
      : []),
    ...(selectedLgaId !== "all"
      ? [{
          id: "lga",
          label: `LGA: ${foundLga ? toTitleCase(foundLga.name) : selectedLgaId}`,
          onRemove: () => {
            setSelectedLgaId("all");
            setSelectedWardId("all");
          },
        }]
      : []),
    ...(selectedWardId !== "all"
      ? [{
          id: "ward",
          label: `Ward: ${foundWard ? toTitleCase(foundWard.name) : selectedWardId}`,
          onRemove: () => setSelectedWardId("all"),
        }]
      : []),
    ...(selectedChannel !== "all"
      ? [{
          id: "channel",
          label: `Channel: ${labelFor(CHANNEL_OPTIONS, selectedChannel)}`,
          onRemove: () => setSelectedChannel("all"),
        }]
      : []),
    ...(selectedCoverageTier !== "all"
      ? [{
          id: "tier",
          label: `Coverage: ${labelFor(COVERAGE_TIER_OPTIONS, selectedCoverageTier)}`,
          onRemove: () => setSelectedCoverageTier("all"),
        }]
      : []),
    ...(selectedRole !== "all"
      ? [{
          id: "role",
          label: `Role: ${labelFor(ROLE_OPTIONS, selectedRole)}`,
          onRemove: () => setSelectedRole("all"),
        }]
      : []),
  ];

  const officeTabs = [
    { id: "all", label: "All" },
    { id: "President", label: "President" },
    { id: "Governor", label: "Governor" },
    { id: "Senate", label: "Senate" },
    { id: "House of Reps", label: "House of Reps" },
    { id: "State Assembly", label: "State Assembly" },
  ];

  return (
    <div className="space-y-4">
      {/* Office tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-muted/70 p-1 scrollbar-none">
          {officeTabs.map((tab) => {
            const active = selectedOffice === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedOffice(tab.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? "bg-background font-semibold text-foreground shadow-sm"
                    : "font-medium text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums transition-opacity ${
                    active ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                  } ${isRefreshing ? "opacity-50" : ""}`}
                >
                  {(officeCounts[tab.id] ?? 0).toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter panel: collapses behind a Filters button on phones, like the Coverage page. */}
      <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
        <TableToolbar inlineMobile activeFilters={activeFilters} onClear={onReset}>
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div className="min-w-0 space-y-1.5">
            <label className={LABEL_CLASS}>Search</label>
            <Input
              type="text"
              placeholder="Candidate or constituency"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full bg-background text-xs"
            />
          </div>

          {/* State */}
          <div className="min-w-0 space-y-1.5">
            <label className={LABEL_CLASS}>
              State
              <FieldSpinner loading={statesBusy} />
            </label>
            <Select
              value={selectedStateId}
              disabled={statesBusy || statesQuery.isError}
              onValueChange={(val) => {
                if (!val) return;
                setSelectedStateId(val);
                setSelectedLgaId("all");
                setSelectedWardId("all");
              }}
            >
              <SelectTrigger className={TRIGGER_CLASS}>
                <SelectValue placeholder="All states">
                  {(val) => {
                    if (statesBusy) return "Loading states…";
                    if (!val || val === "all") return "All states";
                    const found = states.find((st) => String(st.id) === val);
                    return found ? toTitleCase(found.name) : "All states";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                {states.map((st) => (
                  <SelectItem key={st.id} value={String(st.id)}>
                    {toTitleCase(st.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statesQuery.isError && (
              <div role="alert" className="flex items-center gap-2 text-xs text-destructive">
                <span>Could not load states.</span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => void statesQuery.refetch()}
                >
                  Retry
                </Button>
              </div>
            )}
          </div>

          {/* LGA */}
          <div className="min-w-0 space-y-1.5">
            <label className={LABEL_CLASS}>
              LGA (seat overlaps)
              <FieldSpinner loading={lgasBusy} />
            </label>
            <Select
              value={selectedLgaId}
              disabled={selectedStateId === "all" || lgasBusy || lgasQuery.isError}
              onValueChange={(val) => {
                if (!val) return;
                setSelectedLgaId(val);
                setSelectedWardId("all");
              }}
            >
              <SelectTrigger className={TRIGGER_CLASS}>
                <SelectValue placeholder="All LGAs">
                  {(val) => {
                    if (lgasBusy) return "Loading LGAs…";
                    if (!val || val === "all") return "All LGAs";
                    const found = lgas.find((lga) => String(lga.id) === val);
                    return found ? toTitleCase(found.name) : "All LGAs";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All LGAs</SelectItem>
                {lgas.map((lga) => (
                  <SelectItem key={lga.id} value={String(lga.id)}>
                    {toTitleCase(lga.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedStateId !== "all" && lgasQuery.isError && (
              <div role="alert" className="flex items-center gap-2 text-xs text-destructive">
                <span>Could not load LGAs.</span>
                <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => void lgasQuery.refetch()}>
                  Retry
                </Button>
              </div>
            )}
          </div>

          {/* Ward */}
          <div className="min-w-0 space-y-1.5">
            <label className={LABEL_CLASS}>
              Ward (seat overlaps)
              <FieldSpinner loading={wardsBusy} />
            </label>
            <Select
              value={selectedWardId}
              disabled={selectedLgaId === "all" || wardsBusy || wardsQuery.isError}
              onValueChange={(val) => {
                if (val) setSelectedWardId(val);
              }}
            >
              <SelectTrigger className={TRIGGER_CLASS}>
                <SelectValue placeholder="All wards">
                  {(val) => {
                    if (wardsBusy) return "Loading wards…";
                    if (!val || val === "all") return "All wards";
                    const found = wards.find((ward) => String(ward.id) === val);
                    return found ? toTitleCase(found.name) : "All wards";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All wards</SelectItem>
                {wards.map((ward) => (
                  <SelectItem key={ward.id} value={String(ward.id)}>
                    {toTitleCase(ward.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedLgaId !== "all" && wardsQuery.isError && (
              <div role="alert" className="flex items-center gap-2 text-xs text-destructive">
                <span>Could not load wards.</span>
                <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => void wardsQuery.refetch()}>
                  Retry
                </Button>
              </div>
            )}
          </div>

          {/* Channel status */}
          <div className="min-w-0 space-y-1.5">
            <label className={LABEL_CLASS}>Channel status</label>
            <Select
              value={selectedChannel}
              onValueChange={(val) => {
                if (val) setSelectedChannel(val);
              }}
            >
              <SelectTrigger className={TRIGGER_CLASS}>
                <SelectValue placeholder="Any status">
                  {(val) => labelFor(CHANNEL_OPTIONS, val as string | null)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Coverage tier */}
          <div className="min-w-0 space-y-1.5">
            <label className={LABEL_CLASS}>Coverage tier</label>
            <Select
              value={selectedCoverageTier}
              onValueChange={(val) => {
                if (val) setSelectedCoverageTier(val);
              }}
            >
              <SelectTrigger className={TRIGGER_CLASS}>
                <SelectValue placeholder="Any tier">
                  {(val) => labelFor(COVERAGE_TIER_OPTIONS, val as string | null)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {COVERAGE_TIER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Role */}
          <div className="min-w-0 space-y-1.5">
            <label className={LABEL_CLASS}>Role</label>
            <Select
              value={selectedRole}
              onValueChange={(val) => {
                if (val) setSelectedRole(val as CandidateRoleFilter);
              }}
            >
              <SelectTrigger className={TRIGGER_CLASS}>
                <SelectValue placeholder="Candidates + running mates">
                  {(val) => labelFor(ROLE_OPTIONS, val as string | null)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort order */}
          <div className="min-w-0 space-y-1.5">
            <label className={LABEL_CLASS}>Sort order</label>
            <Select
              value={sortOrder}
              onValueChange={(val) => {
                if (val) setSortOrder(val as CandidateSortOrder);
              }}
            >
              <SelectTrigger className={TRIGGER_CLASS}>
                <SelectValue placeholder="Office, then state">
                  {(val) => labelFor(SORT_OPTIONS, val as string | null)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        </TableToolbar>

        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground" aria-live="polite">
          {isRefreshing ? (
            <>
              <FieldSpinner loading />
              Updating results…
            </>
          ) : (
            <>
              {totalCount.toLocaleString()} candidate{totalCount === 1 ? "" : "s"} match
              {totalCount === 1 ? "es" : ""}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
