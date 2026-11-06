"use client";

import React from "react";
import { useGeographyStates, useGeographyLgas, useGeographyWards } from "@/lib/hooks/use-geography";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableToolbar } from "@/components/ui/table-toolbar";
import { Field, FILTER_GRID } from "@/components/ui/wf";
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
  administrative: "Administrative units",
  political: "Political units",
};

const SORT_LABELS: Record<string, string> = {
  inec: "INEC code",
  "pus-desc": "Most polling units",
  "gaps-desc": "Most gaps",
  "coverage-asc": "Lowest coverage",
  "extra-desc": "Most extra agents",
};

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s(/.-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\bFct\b/g, "FCT");
}

const TRIGGER_CLASS = "w-full";

function pillClass(on: boolean, mode: CoverageFilterMode) {
  const base =
    "inline-flex min-h-7 items-center rounded-full border px-3 text-[12px] font-semibold transition-colors";
  if (!on) return `${base} border-[#E5E5E5] bg-white text-[#0A0A0A] hover:bg-[#FAFAFA]`;
  return mode === "gaps"
    ? `${base} border-[#D97706] bg-[#F59E0B] text-white`
    : `${base} border-[#171717] bg-[#171717] text-[#FAFAFA]`;
}

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
  const availableLGAs = React.useMemo(() => (stateCode === "all" ? [] : byCode(apiLgas)), [stateCode, apiLgas]);
  const selectedLga = availableLGAs.find((l) => l.code === lgaCode || String(l.id) === lgaCode);
  const selectedLgaId = selectedLga ? selectedLga.id : null;

  const { data: apiWards = [], isFetching: wardsLoading } = useGeographyWards(selectedLgaId);
  const availableWards = React.useMemo(() => (lgaCode === "all" ? [] : byCode(apiWards)), [lgaCode, apiWards]);
  const selectedWard = availableWards.find((w) => w.code === wardCode || String(w.id) === wardCode);

  const selectedOffice = offices.find((office) => office.id === officeId);
  const lgaBusy = stateCode !== "all" && lgasLoading;
  const wardBusy = lgaCode !== "all" && wardsLoading;
  const isPolitical = viewBy === "political";

  const stateLabel = selectedState ? titleCase(selectedState.name) : stateCode;
  const lgaLabel = selectedLga ? titleCase(selectedLga.name) : lgaCode;
  const wardLabel = selectedWard ? titleCase(selectedWard.name) : wardCode;

  // Breadcrumb: each level above the current one is a link back up.
  const crumbs: Array<{ label: string; go?: () => void }> = [
    {
      label: "Nigeria",
      go: () => {
        setStateCode("all");
        setLgaCode("all");
        setWardCode("all");
      },
    },
    ...(stateCode !== "all"
      ? [
          {
            label: stateLabel,
            go: () => {
              setLgaCode("all");
              setWardCode("all");
            },
          },
        ]
      : []),
    ...(lgaCode !== "all" ? [{ label: lgaLabel, go: () => setWardCode("all") }] : []),
    ...(wardCode !== "all" ? [{ label: wardLabel }] : []),
  ];
  const summary = crumbs.map((c) => c.label).join(" / ");

  const activeFilters = [
    ...(stateCode !== "all"
      ? [
          {
            id: "state",
            label: `State: ${stateLabel}`,
            onRemove: () => {
              setStateCode("all");
              setLgaCode("all");
              setWardCode("all");
            },
          },
        ]
      : []),
    ...(lgaCode !== "all"
      ? [
          {
            id: "lga",
            label: `LGA: ${lgaLabel}`,
            onRemove: () => {
              setLgaCode("all");
              setWardCode("all");
            },
          },
        ]
      : []),
    ...(wardCode !== "all" ? [{ id: "ward", label: `Ward: ${wardLabel}`, onRemove: () => setWardCode("all") }] : []),
    ...(officeId !== null
      ? [{ id: "office", label: `Office: ${selectedOffice ? titleCase(selectedOffice.name) : "Selected"}`, onRemove: () => setOfficeId(null) }]
      : []),
    ...(searchQuery ? [{ id: "search", label: `Search: ${searchQuery}`, onRemove: () => setSearchQuery("") }] : []),
  ];

  const pills = (
    <div role="group" aria-label="Show" className="contents">
      {FILTER_PILLS.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={filterMode === mode}
          onClick={() => setFilterMode(mode)}
          className={pillClass(filterMode === mode, mode)}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-[12px] text-[#737373]">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <React.Fragment key={`${c.label}-${i}`}>
              {i > 0 ? <span aria-hidden="true">›</span> : null}
              {last ? (
                <span className="font-semibold text-[#0A0A0A]">{c.label}</span>
              ) : (
                <button
                  type="button"
                  onClick={c.go}
                  className="min-h-6 border-0 bg-transparent px-0.5 text-[12px] text-[#737373] hover:text-[#0A0A0A]"
                >
                  {c.label}
                </button>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      <TableToolbar
        summary={summary}
        onClear={() => {
          onReset();
          setFilterMode("all");
        }}
        activeFilters={activeFilters}
        meta={pills}
        showClear={activeFilters.length > 0 || filterMode !== "all"}
      >
        <div className={FILTER_GRID}>
          <Field label="Search" htmlFor="pu-search">
            <Input
              id="pu-search"
              type="search"
              autoComplete="off"
              placeholder="Unit, ward, LGA or code"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </Field>

          <Field label="View by">
            <Select
              value={viewBy}
              onValueChange={(val) => {
                if (val === "administrative" || val === "political") setViewBy(val);
              }}
            >
              <SelectTrigger className={TRIGGER_CLASS}>
                <SelectValue>{(val) => VIEW_BY_LABELS[val as CoverageViewBy] ?? "Administrative units"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="administrative">Administrative units</SelectItem>
                <SelectItem value="political">Political units</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="State">
            <Select
              value={stateCode}
              onValueChange={(val) => {
                if (val) {
                  setStateCode(val);
                  setLgaCode("all");
                  setWardCode("all");
                }
              }}
            >
              <SelectTrigger className={TRIGGER_CLASS}>
                <SelectValue>
                  {(val) => {
                    if (!val || val === "all") return "All states";
                    const found = statesList.find((s) => s.code === val || String(s.id) === val);
                    return found ? `${found.code} · ${titleCase(found.name)}` : val;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                {statesList.map((st) => (
                  <SelectItem key={st.code} value={st.code}>
                    {st.code} · {titleCase(st.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {isPolitical ? (
            <Field label="Office" extra={<FieldSpinner loading={officesLoading} />}>
              <Select
                value={officeId === null ? "all" : String(officeId)}
                onValueChange={(val) => setOfficeId(val && val !== "all" ? Number(val) : null)}
                disabled={offices.length === 0 || officesLoading}
              >
                <SelectTrigger className={TRIGGER_CLASS}>
                  <SelectValue>
                    {() => (officesLoading ? "Loading offices…" : selectedOffice ? titleCase(selectedOffice.name) : "All offices")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All offices</SelectItem>
                  {offices.map((office) => (
                    <SelectItem key={office.id} value={String(office.id)}>
                      {titleCase(office.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <Field label="LGA" extra={<FieldSpinner loading={lgaBusy} />}>
            <Select
              value={lgaCode}
              onValueChange={(val) => {
                if (val) {
                  setLgaCode(val);
                  setWardCode("all");
                }
              }}
              disabled={stateCode === "all" || lgaBusy}
            >
              <SelectTrigger className={TRIGGER_CLASS}>
                <SelectValue>
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
          </Field>

          <Field label="Ward / area" extra={<FieldSpinner loading={wardBusy} />}>
            <Select
              value={wardCode}
              onValueChange={(val) => {
                if (val) setWardCode(val);
              }}
              disabled={lgaCode === "all" || wardBusy}
            >
              <SelectTrigger className={TRIGGER_CLASS}>
                <SelectValue>
                  {(val) => {
                    if (wardBusy) return "Loading wards…";
                    if (!val || val === "all") return "All wards";
                    const found = availableWards.find((w) => w.code === val || String(w.id) === val);
                    return found ? `${found.code} · ${titleCase(found.name)}` : val;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All wards</SelectItem>
                {availableWards.map((w) => (
                  <SelectItem key={w.code} value={w.code}>
                    {w.code} · {titleCase(w.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Sort order">
            <Select
              value={sortBy}
              onValueChange={(val) => {
                if (val) setSortBy(val);
              }}
            >
              <SelectTrigger className={TRIGGER_CLASS}>
                <SelectValue>{(val) => SORT_LABELS[val ?? ""] ?? "INEC code"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SORT_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </TableToolbar>
    </div>
  );
}
