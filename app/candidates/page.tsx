"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useCandidates } from "@/lib/hooks/use-candidates";
import { useGeographyStates } from "@/lib/hooks/use-geography";
import {
  CandidatesFilters,
  type CandidateRoleFilter,
  type CandidateSortOrder,
} from "@/components/candidates/candidates-filters";
import { CandidatesTable } from "@/components/candidates/candidates-table";
import { CandidatesDirectorySkeleton } from "@/components/candidates/candidates-skeletons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Send, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import type { CandidateData } from "@/lib/types";

const SEARCH_DEBOUNCE_MS = 400;
const OFFICE_TABS = ["President", "Governor", "Senate", "House of Reps", "State Assembly"];

function toId(value: string): number | null {
  return value === "all" ? null : Number(value);
}

export default function CandidatesPage() {
  const [selectedOffice, setSelectedOffice] = useState<string>("all");
  const [selectedStateId, setSelectedStateId] = useState<string>("all");
  const [selectedLgaId, setSelectedLgaId] = useState<string>("all");
  const [selectedWardId, setSelectedWardId] = useState<string>("all");
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [selectedCoverageTier, setSelectedCoverageTier] = useState<string>("all");
  const [selectedRole, setSelectedRole] = useState<CandidateRoleFilter>("all");
  const [sortOrder, setSortOrder] = useState<CandidateSortOrder>("office");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [selectedOfficeId, setSelectedOfficeId] = useState<number | undefined>(undefined);

  // State, LGA and ward are applied by the API as "seat overlaps this area".
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCandidates({
    officeId: selectedOfficeId,
    stateId: toId(selectedStateId),
    lgaId: toId(selectedLgaId),
    wardId: toId(selectedWardId),
  });

  const statesQuery = useGeographyStates();
  const stateNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const state of statesQuery.data ?? []) map.set(state.code, state.name);
    return map;
  }, [statesQuery.data]);

  // Office options come with the first page of every query.
  const knownOffices = useMemo(() => data?.pages[0]?.offices ?? [], [data]);

  const handleSelectOffice = (name: string) => {
    setSelectedOffice(name);
    setSelectedOfficeId(knownOffices.find((office) => office.name === name)?.id);
  };

  const rawCandidates = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );
  const apiTotal = data?.pages[0]?.total ?? 0;

  const officeCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: knownOffices.reduce((sum, office) => sum + office.count, 0),
    };
    for (const name of OFFICE_TABS) counts[name] = 0;
    for (const office of knownOffices) {
      if (counts[office.name] !== undefined) counts[office.name] = office.count;
    }
    return counts;
  }, [knownOffices]);

  // The API filters by office and area; these remaining filters apply to the rows loaded so far.
  const hasLocalFilters =
    selectedChannel !== "all" ||
    selectedCoverageTier !== "all" ||
    selectedRole !== "all" ||
    debouncedSearch !== "";

  const filteredCandidates = useMemo(() => {
    const filtered = rawCandidates.filter((cand) => {
      // Channel status filter
      if (selectedChannel !== "all" && cand.telegramStatus !== selectedChannel) {
        return false;
      }

      // Coverage tier filter ("unmapped" = no polling units mapped to the seat yet)
      if (selectedCoverageTier !== "all") {
        const mapped = cand.totalPUs > 0;
        if (selectedCoverageTier === "unmapped") return !mapped;
        if (!mapped) return false;
        if (selectedCoverageTier === "high" && cand.coveragePct < 50) return false;
        if (selectedCoverageTier === "medium" && (cand.coveragePct < 30 || cand.coveragePct >= 50)) return false;
        if (selectedCoverageTier === "critical" && cand.coveragePct >= 30) return false;
      }

      // Role filter: running mates only keeps tickets that have one
      if (selectedRole === "running_mates" && !cand.deputyName) {
        return false;
      }

      // Search query
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        const matchesName = cand.name.toLowerCase().includes(q);
        const matchesSeat = cand.seat.toLowerCase().includes(q);
        const matchesDeputy = cand.deputyName?.toLowerCase().includes(q);
        const matchesOffice = cand.office.toLowerCase().includes(q);
        if (!matchesName && !matchesSeat && !matchesDeputy && !matchesOffice) {
          return false;
        }
      }

      return true;
    });

    // Running mates only: list the deputy on their own line, under their principal's seat.
    const rows: CandidateData[] =
      selectedRole === "running_mates"
        ? filtered.map((cand) => ({ ...cand, name: cand.deputyName ?? cand.name, deputyName: null }))
        : filtered;

    const officeRank = (office: string) => {
      const index = OFFICE_TABS.indexOf(office);
      return index === -1 ? OFFICE_TABS.length : index;
    };
    // National seats (no state) sort first.
    const stateName = (cand: CandidateData) =>
      cand.stateCode ? stateNameByCode.get(cand.stateCode) ?? cand.stateCode : "";
    const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

    return [...rows].sort((a, b) => {
      switch (sortOrder) {
        case "state":
          return byText(stateName(a), stateName(b)) || officeRank(a.office) - officeRank(b.office) || byText(a.seat, b.seat);
        case "candidate":
          return byText(a.name, b.name);
        case "seat":
          return byText(a.seat, b.seat);
        case "coverage_desc":
          return b.coveragePct - a.coveragePct || b.coveredPUs - a.coveredPUs;
        case "coverage_asc":
          return a.coveragePct - b.coveragePct || a.coveredPUs - b.coveredPUs;
        case "extra_desc":
          return b.extraAgentsCount - a.extraAgentsCount;
        case "office":
        default:
          return officeRank(a.office) - officeRank(b.office) || byText(stateName(a), stateName(b)) || byText(a.seat, b.seat);
      }
    });
  }, [
    rawCandidates,
    selectedChannel,
    selectedCoverageTier,
    selectedRole,
    debouncedSearch,
    sortOrder,
    stateNameByCode,
  ]);

  const matchCount = hasLocalFilters ? filteredCandidates.length : apiTotal;
  // A filter, tab or area change refetches while the previous rows stay on screen.
  const isRefreshing = isFetching && !isFetchingNextPage && !isLoading;
  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Office,Candidate Name,Running Mate,Constituency/Seat,State Code,Covered PUs,Total PUs,Coverage %,Extra Agents,Phone (Masked),Channel Status\n";

    filteredCandidates.forEach((c) => {
      csvContent += `"${c.office}","${c.name}","${c.deputyName || ""}","${c.seat}","${c.stateCode || "National"}",${c.coveredPUs},${c.totalPUs},"${c.coveragePct}%",${c.extraAgentsCount},"${c.phoneMasked ?? ""}","${c.telegramStatus}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ndc-candidates-directory-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return <CandidatesDirectorySkeleton viewMode="table" />;
  }

  if (error && !data) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-6 rounded-xl border border-border bg-card text-center space-y-3">
        <AlertCircle className="w-6 h-6 text-amber-600 mx-auto" />
        <p className="text-sm font-semibold text-foreground">Could not load candidate registry</p>
        <p className="text-xs text-muted-foreground">
          {error.message || "An unexpected error occurred while fetching candidate tickets."}
        </p>
        <Button size="sm" onClick={() => refetch()} className="gap-1.5 text-xs">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            NDC Candidates Directory
          </h1>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
            Nigeria · names and seats from INEC&apos;s 2027 final lists
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={handleExportCSV} className="h-8 px-3 text-xs">
            Export CSV
          </Button>
          {/* Broadcasts reach agents only for now, so candidates can't be messaged yet.
              A disabled button gets no hover events, so the tooltip sits on a wrapper. */}
          <Tooltip>
            <TooltipTrigger render={<span tabIndex={0} className="inline-flex cursor-not-allowed rounded-lg" />}>
              <Button
                disabled
                className="h-8 gap-1.5 bg-foreground px-3 text-xs font-medium text-background hover:bg-foreground/90"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  Message Filtered ({isRefreshing ? "…" : matchCount.toLocaleString()})
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Not available yet: broadcasts reach agents only</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <CandidatesFilters
        selectedOffice={selectedOffice}
        setSelectedOffice={handleSelectOffice}
        officeCounts={officeCounts}
        selectedStateId={selectedStateId}
        setSelectedStateId={setSelectedStateId}
        selectedLgaId={selectedLgaId}
        setSelectedLgaId={setSelectedLgaId}
        selectedWardId={selectedWardId}
        setSelectedWardId={setSelectedWardId}
        selectedChannel={selectedChannel}
        setSelectedChannel={setSelectedChannel}
        selectedCoverageTier={selectedCoverageTier}
        setSelectedCoverageTier={setSelectedCoverageTier}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        totalCount={matchCount}
        isRefreshing={isRefreshing}
      />

      {error && data ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-50/60 px-4 py-2.5 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Couldn&apos;t update the list. Showing the last results loaded.
          </span>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : null}

      <section
        aria-busy={isRefreshing}
        className="relative min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card p-3 sm:p-4"
      >
        <div
          className={`space-y-3 transition-opacity ${isRefreshing ? "pointer-events-none opacity-40" : ""}`}
        >
        <CandidatesTable
          candidates={filteredCandidates}
          stateNames={stateNameByCode}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
          totalCount={matchCount}
          hasMore={Boolean(hasNextPage)}
          isLoadingMore={isFetchingNextPage}
          onLoadMore={loadMore}
          resetKey={[
            selectedOffice,
            selectedStateId,
            selectedLgaId,
            selectedWardId,
            selectedChannel,
            selectedCoverageTier,
            selectedRole,
            sortOrder,
            debouncedSearch,
          ].join("|")}
        />
        </div>
        {isRefreshing && (
          <div
            role="status"
            className="absolute inset-0 z-10 flex items-center justify-center"
          >
            <span className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Loading candidates…
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
