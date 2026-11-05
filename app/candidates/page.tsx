"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useCandidates } from "@/lib/hooks/use-candidates";
import { CandidatesFilters } from "@/components/candidates/candidates-filters";
import { CandidatesTable } from "@/components/candidates/candidates-table";
import { CandidatesCards } from "@/components/candidates/candidates-cards";
import { CandidatesDirectorySkeleton } from "@/components/candidates/candidates-skeletons";
import { Button } from "@/components/ui/button";
import {
  Send,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

const SEARCH_DEBOUNCE_MS = 400;
const OFFICE_TABS = ["President", "Governor", "Senate", "House of Reps", "State Assembly"];

export default function CandidatesPage() {
  const [selectedOffice, setSelectedOffice] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [selectedCoverageTier, setSelectedCoverageTier] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [selectedOfficeId, setSelectedOfficeId] = useState<number | undefined>(undefined);

  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCandidates({ officeId: selectedOfficeId });

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

  // The API filters by office only; these remaining filters apply to the rows loaded so far.
  const hasLocalFilters =
    selectedState !== "all" ||
    selectedChannel !== "all" ||
    selectedCoverageTier !== "all" ||
    debouncedSearch !== "";

  const filteredCandidates = useMemo(() => {
    return rawCandidates.filter((cand) => {
      // State filter
      if (selectedState !== "all" && cand.stateCode && cand.stateCode !== selectedState) {
        return false;
      }

      // Channel status filter
      if (selectedChannel !== "all" && cand.telegramStatus !== selectedChannel) {
        return false;
      }

      // Coverage tier filter
      if (selectedCoverageTier !== "all") {
        if (selectedCoverageTier === "high" && cand.coveragePct < 50) return false;
        if (selectedCoverageTier === "medium" && (cand.coveragePct < 30 || cand.coveragePct >= 50)) return false;
        if (selectedCoverageTier === "critical" && cand.coveragePct >= 30) return false;
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
  }, [rawCandidates, selectedState, selectedChannel, selectedCoverageTier, debouncedSearch]);

  const handleResetFilters = () => {
    setSelectedOffice("all");
    setSelectedOfficeId(undefined);
    setSelectedState("all");
    setSelectedChannel("all");
    setSelectedCoverageTier("all");
    setSearchQuery("");
    setDebouncedSearch("");
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Office,Candidate Name,Running Mate,Constituency/Seat,State Code,Covered PUs,Total PUs,Coverage %,Extra Agents,Phone (Masked),    Channel Status\n";

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
    return <CandidatesDirectorySkeleton viewMode={viewMode} />;
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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            NDC Candidates Directory
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Official party registry of presidential, gubernatorial, senatorial, reps, and assembly tickets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/broadcasts/new?group=candidates"
            className="inline-flex items-center justify-center rounded-lg text-xs font-medium h-8 px-3.5 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Broadcast to Candidates</span>
          </Link>
        </div>
      </div>

      <section className="min-w-0 space-y-3 overflow-hidden rounded-xl border border-border/70 bg-card p-3 sm:p-4">
        <CandidatesFilters
          selectedOffice={selectedOffice}
          setSelectedOffice={handleSelectOffice}
          selectedState={selectedState}
          setSelectedState={setSelectedState}
          selectedChannel={selectedChannel}
          setSelectedChannel={setSelectedChannel}
          selectedCoverageTier={selectedCoverageTier}
          setSelectedCoverageTier={setSelectedCoverageTier}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          viewMode={viewMode}
          setViewMode={setViewMode}
          officeCounts={officeCounts}
          totalCount={hasLocalFilters ? filteredCandidates.length : apiTotal}
          onReset={handleResetFilters}
          onExportCSV={handleExportCSV}
        />
        {viewMode === "table" ? (
          <CandidatesTable candidates={filteredCandidates} />
        ) : (
          <CandidatesCards candidates={filteredCandidates} />
        )}
        {hasNextPage && (
          <div className="flex justify-center pt-1">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
            >
              {isFetchingNextPage ? "Loading..." : "Load more"}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
