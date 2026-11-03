"use client";

import React, { useState, useMemo } from "react";
import { useCandidates } from "@/lib/hooks/use-candidates";
import { CandidateData, OfficeType } from "@/lib/types";
import { useApp } from "@/lib/context/app-context";
import { CandidatesFilters } from "@/components/candidates/candidates-filters";
import { CandidatesTable } from "@/components/candidates/candidates-table";
import { CandidatesCards } from "@/components/candidates/candidates-cards";
import { CandidatesDirectorySkeleton } from "@/components/candidates/candidates-skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  ShieldCheck,
  Send,
  Download,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

export default function CandidatesPage() {
  const { activePersona } = useApp();
  const { data: rawCandidates = [], isLoading, error, refetch } = useCandidates();

  const [selectedOffice, setSelectedOffice] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [selectedCoverageTier, setSelectedCoverageTier] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Dynamic office counts
  const officeCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: rawCandidates.length,
      President: 0,
      Governor: 0,
      Senate: 0,
      "House of Reps": 0,
      "State Assembly": 0,
    };
    rawCandidates.forEach((c) => {
      if (counts[c.office] !== undefined) {
        counts[c.office]++;
      }
    });
    return counts;
  }, [rawCandidates]);

  // Filter candidates
  const filteredCandidates = useMemo(() => {
    return rawCandidates.filter((cand) => {
      // Office filter
      if (selectedOffice !== "all" && cand.office !== selectedOffice) {
        return false;
      }

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
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
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
  }, [rawCandidates, selectedOffice, selectedState, selectedChannel, selectedCoverageTier, searchQuery]);

  const handleResetFilters = () => {
    setSelectedOffice("all");
    setSelectedState("all");
    setSelectedChannel("all");
    setSelectedCoverageTier("all");
    setSearchQuery("");
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Office,Candidate Name,Running Mate,Constituency/Seat,State Code,Covered PUs,Total PUs,Coverage %,Extra Agents,Phone (Masked),Channel Status,INEC Source\n";

    filteredCandidates.forEach((c) => {
      csvContent += `"${c.office}","${c.name}","${c.deputyName || ""}","${c.seat}","${c.stateCode || "National"}",${c.coveredPUs},${c.totalPUs},"${c.coveragePct}%",${c.extraAgentsCount},"${c.phoneMasked}","${c.telegramStatus}","${c.source}"\n`;
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
    return <CandidatesDirectorySkeleton />;
  }

  if (error) {
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
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              NDC Candidates Directory
            </h1>
            <Badge variant="outline" className="text-xs px-2 py-0.5 gap-1 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-300">
              <Users className="w-3 h-3" />
              2027 Validated
            </Badge>
          </div>
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

      {/* Filters Bar */}
      <CandidatesFilters
        selectedOffice={selectedOffice}
        setSelectedOffice={setSelectedOffice}
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
        totalCount={filteredCandidates.length}
        onReset={handleResetFilters}
        onExportCSV={handleExportCSV}
      />

      {/* Main Display: Table vs Cards */}
      {viewMode === "table" ? (
        <CandidatesTable candidates={filteredCandidates} />
      ) : (
        <CandidatesCards candidates={filteredCandidates} />
      )}
    </div>
  );
}
