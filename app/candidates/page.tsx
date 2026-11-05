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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WF, PageHeader, LoadingBox, CenterSpinner } from "@/components/ui/wf";
import { Send, AlertCircle, RefreshCw } from "lucide-react";
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

  // Clears the filters; the office tab and sort order stay as they are.
  const handleResetFilters = () => {
    setSelectedStateId("all");
    setSelectedLgaId("all");
    setSelectedWardId("all");
    setSelectedChannel("all");
    setSelectedCoverageTier("all");
    setSelectedRole("all");
    setSearchQuery("");
    setDebouncedSearch("");
  };
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
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="NDC Candidates Directory" subtitle="Loading…" />
        <LoadingBox>Loading candidates…</LoadingBox>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={`${WF.card} mx-auto mt-16 max-w-xl space-y-3 p-6 text-center`}>
        <AlertCircle className="mx-auto h-6 w-6 text-[#B45309]" />
        <p className="text-[14px] font-semibold text-[#0A0A0A]">Could not load candidate registry</p>
        <p className="text-[12px] text-[#737373]">
          {error.message || "An unexpected error occurred while fetching candidate tickets."}
        </p>
        <button type="button" onClick={() => refetch()} className={WF.btnDark}>
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 text-[#0A0A0A] sm:gap-4">
      <PageHeader
        title="NDC Candidates Directory"
        subtitle="Nigeria · names and seats from INEC’s 2027 final lists"
        actions={
          <>
            <button type="button" onClick={handleExportCSV} className={WF.btnOutline}>
              Export CSV
            </button>
            {/* Broadcasts reach agents only for now, so candidates can't be messaged yet.
                A disabled button gets no hover events, so the tooltip sits on a wrapper. */}
            <Tooltip>
              <TooltipTrigger render={<span tabIndex={0} className="inline-flex cursor-not-allowed" />}>
                <button type="button" disabled className={WF.btnDark}>
                  <Send className="h-3.5 w-3.5" />
                  Message Filtered ({isRefreshing ? "…" : matchCount.toLocaleString()})
                </button>
              </TooltipTrigger>
              <TooltipContent>Not available yet: broadcasts reach agents only</TooltipContent>
            </Tooltip>
          </>
        }
      />

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
        onReset={handleResetFilters}
      />

      {error && data ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-[10px] border border-[#F5E2A8] bg-[#FEF9E7] px-3 py-2 text-[13px] text-[#7A5A00]"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Couldn&apos;t update the list. Showing the last results loaded.
          </span>
          <button type="button" className={WF.btnRow} onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      ) : null}

      <section aria-busy={isRefreshing} className="relative min-w-0">
        <CenterSpinner show={isRefreshing} />
        <div className={`transition-opacity ${isRefreshing ? "pointer-events-none opacity-40" : ""}`}>
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
      </section>

      <p className={WF.note}>
        Names and seats: INEC 2027 final lists. * Coverage: polling units with the official agent (the party&rsquo;s one
        INEC-recognised agent, who stands for every NDC candidate at the unit), of all polling units in the seat; tiers:
        High 50%+, Medium 30–49%, Critical below 30%. Extra agents are other registered people a candidate fields; they
        never change coverage.
      </p>
    </div>
  );
}
