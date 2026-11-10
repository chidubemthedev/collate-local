"use client";

import React from "react";
import { useGeographyStates, useGeographyLgas, useGeographyWards } from "@/lib/hooks/use-geography";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldSpinner } from "@/components/ui/field-spinner";
import { TableToolbar, type ActiveTableFilter } from "@/components/ui/table-toolbar";
import { toTitleCase } from "@/components/candidates/candidates-filters";
import { useOwnerGroups } from "@/lib/hooks/use-groups";
import { WF, Field, FILTER_GRID } from "@/components/ui/wf";

export type AgentTypeFilter = "all" | "official" | "extra" | "gaps";

// Agent kind as stored on the assignment (official or extra).
const TYPE_OPTIONS = [
  { value: "all", label: "Any type" },
  { value: "official", label: "Official" },
  { value: "extra", label: "Extra" },
  { value: "gaps", label: "Gaps (no official agent)" },
] as const;

function labelFor(options: ReadonlyArray<{ value: string; label: string }>, value: string | null) {
  return options.find((option) => option.value === value)?.label ?? options[0].label;
}

const TRIGGER_CLASS = "w-full";

interface AgentsFiltersProps {
  selectedState: string;
  setSelectedState: (state: string) => void;
  selectedLga: string;
  setSelectedLga: (lga: string) => void;
  selectedWard: string;
  setSelectedWard: (ward: string) => void;
  /** "all" or an owner group id as a string. */
  selectedSponsor: string;
  setSelectedSponsor: (sponsor: string) => void;
  selectedType: AgentTypeFilter;
  setSelectedType: (type: AgentTypeFilter) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  totalFilteredCount: number;
  /** The records are refetching after a filter change. */
  isRefreshing?: boolean;
  onClear: () => void;
}

export function AgentsFilters({
  selectedState,
  setSelectedState,
  selectedLga,
  setSelectedLga,
  selectedWard,
  setSelectedWard,
  selectedSponsor,
  setSelectedSponsor,
  selectedType,
  setSelectedType,
  searchQuery,
  setSearchQuery,
  totalFilteredCount,
  isRefreshing = false,
  onClear,
}: AgentsFiltersProps) {
  const { data: statesList = [], isPending: statesPending } = useGeographyStates();
  const foundState = statesList.find((s) => s.code === selectedState || String(s.id) === selectedState);
  const selectedStateId = foundState ? foundState.id : null;

  const { data: apiLgas = [], isFetching: lgasFetching } = useGeographyLgas(selectedStateId);
  const availableLGAs = selectedState === "all" ? [] : apiLgas;
  const foundLga = availableLGAs.find((l) => l.code === selectedLga || String(l.id) === selectedLga);
  const selectedLgaId = foundLga ? foundLga.id : null;

  const { data: apiWards = [], isFetching: wardsFetching } = useGeographyWards(selectedLgaId);
  const availableWards = selectedLga === "all" ? [] : apiWards;

  const lgaBusy = selectedState !== "all" && lgasFetching;
  const wardBusy = selectedLga !== "all" && wardsFetching;
  const foundWard = availableWards.find((w) => w.code === selectedWard || String(w.id) === selectedWard);

  const groupsQuery = useOwnerGroups();
  const ownerGroups = groupsQuery.data ?? [];
  const groupsBusy = groupsQuery.isPending;
  const sponsorName = (value: string | null) => {
    if (!value || value === "all") return "Anyone";
    return ownerGroups.find((group) => String(group.id) === value)?.name ?? "Anyone";
  };

  const activeFilters: ActiveTableFilter[] = [
    ...(searchQuery.trim()
      ? [{ id: "search", label: `Search: ${searchQuery.trim()}`, onRemove: () => setSearchQuery("") }]
      : []),
    ...(selectedState !== "all"
      ? [
          {
            id: "state",
            label: `State: ${foundState ? toTitleCase(foundState.name) : selectedState}`,
            onRemove: () => {
              setSelectedState("all");
              setSelectedLga("all");
              setSelectedWard("all");
            },
          },
        ]
      : []),
    ...(selectedLga !== "all"
      ? [
          {
            id: "lga",
            label: `LGA: ${foundLga ? toTitleCase(foundLga.name) : selectedLga}`,
            onRemove: () => {
              setSelectedLga("all");
              setSelectedWard("all");
            },
          },
        ]
      : []),
    ...(selectedWard !== "all"
      ? [
          {
            id: "ward",
            label: `Ward: ${foundWard ? toTitleCase(foundWard.name) : selectedWard}`,
            onRemove: () => setSelectedWard("all"),
          },
        ]
      : []),
    ...(selectedSponsor !== "all"
      ? [
          {
            id: "sponsor",
            label: `Sponsor: ${sponsorName(selectedSponsor)}`,
            onRemove: () => setSelectedSponsor("all"),
          },
        ]
      : []),
    ...(selectedType !== "all"
      ? [
          {
            id: "type",
            label: `Type: ${labelFor(TYPE_OPTIONS, selectedType)}`,
            onRemove: () => setSelectedType("all"),
          },
        ]
      : []),
  ];

  return (
    <section aria-label="Filters" className={`${WF.card} p-3 sm:px-4 sm:py-3.5`}>
      {/* Collapses behind a Filters bar on phones. */}
      <TableToolbar
        activeFilters={activeFilters}
        onClear={onClear}
        summary={activeFilters.length ? "Filtered" : "None set"}
        meta={
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[#737373]" aria-live="polite">
            {isRefreshing ? (
              <>
                <FieldSpinner loading />
                Updating results…
              </>
            ) : selectedState === "all" ? (
              "Pick a state to list agent records"
            ) : (
              `${totalFilteredCount.toLocaleString()} record${totalFilteredCount === 1 ? "" : "s"} match${
                totalFilteredCount === 1 ? "es" : ""
              }`
            )}
          </span>
        }
      >
      <div className={FILTER_GRID}>
        <Field label="Search" htmlFor="ag-search">
          <Input
            id="ag-search"
            type="search"
            autoComplete="off"
            placeholder="Agent name or PU code"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </Field>

        <Field label="State" extra={<FieldSpinner loading={statesPending} />}>
          <Select
            value={selectedState}
            disabled={statesPending}
            onValueChange={(val) => {
              if (!val) return;
              setSelectedState(val);
              setSelectedLga("all");
              setSelectedWard("all");
            }}
          >
            <SelectTrigger className={TRIGGER_CLASS}>
              <SelectValue placeholder="All states">
                {(val) => {
                  if (statesPending) return "Loading states…";
                  if (!val || val === "all") return "All states";
                  const found = statesList.find((s) => s.code === val || String(s.id) === val);
                  return found ? toTitleCase(found.name) : "All states";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              {statesList.map((st) => (
                <SelectItem key={st.code} value={st.code}>
                  {toTitleCase(st.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="LGA" extra={<FieldSpinner loading={lgaBusy} />}>
          <Select
            value={selectedLga}
            disabled={selectedState === "all" || lgaBusy}
            onValueChange={(val) => {
              if (!val) return;
              setSelectedLga(val);
              setSelectedWard("all");
            }}
          >
            <SelectTrigger className={TRIGGER_CLASS}>
              <SelectValue placeholder="All LGAs">
                {(val) => {
                  if (lgaBusy) return "Loading LGAs…";
                  if (!val || val === "all") return "All LGAs";
                  const found = availableLGAs.find((l) => l.code === val || String(l.id) === val);
                  return found ? toTitleCase(found.name) : "All LGAs";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All LGAs</SelectItem>
              {availableLGAs.map((lga) => (
                <SelectItem key={lga.code} value={lga.code}>
                  {toTitleCase(lga.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Ward" extra={<FieldSpinner loading={wardBusy} />}>
          <Select
            value={selectedWard}
            disabled={selectedLga === "all" || wardBusy}
            onValueChange={(val) => {
              if (val) setSelectedWard(val);
            }}
          >
            <SelectTrigger className={TRIGGER_CLASS}>
              <SelectValue placeholder="All wards">
                {(val) => {
                  if (wardBusy) return "Loading wards…";
                  if (!val || val === "all") return "All wards";
                  const found = availableWards.find((w) => w.code === val || String(w.id) === val);
                  return found ? toTitleCase(found.name) : "All wards";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All wards</SelectItem>
              {availableWards.map((w) => (
                <SelectItem key={w.code} value={w.code}>
                  {toTitleCase(w.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Sponsor / owner" extra={<FieldSpinner loading={groupsBusy} />}>
          <Select
            value={selectedSponsor}
            disabled={groupsBusy || groupsQuery.isError}
            onValueChange={(val) => {
              if (val) setSelectedSponsor(val);
            }}
          >
            <SelectTrigger className={TRIGGER_CLASS}>
              <SelectValue placeholder="Anyone">
                {(val) => (groupsBusy ? "Loading groups…" : sponsorName(val as string | null))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anyone</SelectItem>
              {ownerGroups.map((group) => (
                <SelectItem key={group.id} value={String(group.id)}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {groupsQuery.isError && (
            <div role="alert" className="flex items-center gap-2 text-[12px] text-[#B42318]">
              <span>Could not load groups.</span>
              <button
                type="button"
                className="border-0 bg-transparent p-0 font-semibold underline"
                onClick={() => void groupsQuery.refetch()}
              >
                Retry
              </button>
            </div>
          )}
        </Field>

        <Field label="Type">
          <Select
            value={selectedType}
            onValueChange={(val) => {
              if (val === "all" || val === "official" || val === "extra" || val === "gaps") setSelectedType(val);
            }}
          >
            <SelectTrigger className={TRIGGER_CLASS}>
              <SelectValue placeholder="Any type">
                {(val) => labelFor(TYPE_OPTIONS, val as string | null)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((option) => (
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
  );
}
