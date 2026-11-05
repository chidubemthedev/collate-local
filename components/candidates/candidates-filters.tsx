"use client";

import React from "react";
import {
  useGeographyStates,
  useGeographyLgas,
  useGeographyWards,
} from "@/lib/hooks/use-geography";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldSpinner } from "@/components/ui/field-spinner";
import { TableToolbar, type ActiveTableFilter } from "@/components/ui/table-toolbar";
import { WF, Field, FILTER_GRID } from "@/components/ui/wf";

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

const TRIGGER_CLASS = "w-full";

function RetryLine({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-2 text-[12px] text-[#B42318]">
      <span>Could not load {what}.</span>
      <button type="button" className="border-0 bg-transparent p-0 font-semibold underline" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

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
    <div className="flex flex-col gap-3 sm:gap-4">
      <div
        role="tablist"
        aria-label="Office"
        className="flex max-w-full gap-1 self-start overflow-x-auto rounded-[10px] bg-[#F4F4F5] p-[3px]"
      >
        {officeTabs.map((tab) => {
          const active = selectedOffice === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedOffice(tab.id)}
              className={`inline-flex min-h-[30px] flex-none items-center gap-1.5 rounded-[8px] border-0 px-3 text-[13px] ${
                active
                  ? "bg-white font-semibold text-[#0A0A0A] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                  : "bg-transparent font-medium text-[#525252]"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums transition-opacity ${
                  active ? "bg-[#171717] text-[#FAFAFA]" : "bg-[#E5E5E5] text-[#525252]"
                } ${isRefreshing ? "opacity-50" : ""}`}
              >
                {(officeCounts[tab.id] ?? 0).toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter panel: collapses behind a Filters bar on phones. */}
      <section aria-label="Filters" className={`${WF.card} p-3 sm:px-4 sm:py-3.5`}>
        <TableToolbar
          activeFilters={activeFilters}
          onClear={onReset}
          summary={activeFilters.length ? "Filtered" : "None set"}
          meta={
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[#737373]" aria-live="polite">
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
            </span>
          }
        >
        <div className={FILTER_GRID}>
          <Field label="Search">
            <Input
              type="text"
              placeholder="Candidate or constituency"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </Field>

          <Field label="State" extra={<FieldSpinner loading={statesBusy} />}>
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
              <RetryLine what="states" onRetry={() => void statesQuery.refetch()} />
            )}
          </Field>

          <Field label="LGA (seat overlaps)" extra={<FieldSpinner loading={lgasBusy} />}>
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
              <RetryLine what="LGAs" onRetry={() => void lgasQuery.refetch()} />
            )}
          </Field>

          <Field label="Ward (seat overlaps)" extra={<FieldSpinner loading={wardsBusy} />}>
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
              <RetryLine what="wards" onRetry={() => void wardsQuery.refetch()} />
            )}
          </Field>

          <Field label="Channel status">
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
          </Field>

          <Field label="Coverage tier">
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
          </Field>

          <Field label="Role">
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
          </Field>

          <Field label="Sort order">
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
          </Field>
        </div>
        </TableToolbar>
      </section>
    </div>
  );
}
