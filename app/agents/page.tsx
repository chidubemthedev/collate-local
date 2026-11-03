"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/context/app-context";
import { useGeographyStates, useGeographyLgas, useGeographyWards } from "@/lib/hooks/use-geography";
import { useCoverageSummary, useCoverageGaps } from "@/lib/hooks/use-coverage";
import { useAgents } from "@/lib/hooks/use-agents";
import { AgentsKPISummary } from "@/components/agents/agents-kpi-summary";
import { AgentsFilters } from "@/components/agents/agents-filters";
import { AgentsTable } from "@/components/agents/agents-table";
import { UnifiedAgentRecord } from "@/components/agents/agent-detail-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  ShieldCheck,
  Send,
  Download,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

export default function AgentsPage() {
  const {
    activePersona,
    selectedStateCode,
    setSelectedStateCode,
    selectedLgaCode,
    setSelectedLgaCode,
    selectedWardCode,
    setSelectedWardCode,
    resetAreaFilters,
  } = useApp();

  const [selectedTypeTab, setSelectedTypeTab] = useState<"all" | "official" | "extra" | "gaps">("all");
  const [selectedSponsor, setSelectedSponsor] = useState<string>("all");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // 1. Resolve numeric geography IDs for API filtering
  const {
    data: apiStates = [],
    isLoading: isLoadingStates,
    error: statesError,
    refetch: refetchStates,
  } = useGeographyStates();
  const statesList = apiStates;

  const selectedState = useMemo(() => {
    return statesList.find(
      (s) => s.code === selectedStateCode || String(s.id) === selectedStateCode
    );
  }, [statesList, selectedStateCode]);

  const selectedStateId = useMemo(() => {
    return selectedState ? selectedState.id : null;
  }, [selectedState]);

  const { data: apiLgas = [], error: lgasError, refetch: refetchLgas } = useGeographyLgas(selectedStateId);
  const lgasList = useMemo(() => {
    if (selectedStateCode === "all") return [];
    return apiLgas;
  }, [selectedStateCode, apiLgas]);

  const selectedLga = useMemo(() => {
    return lgasList.find(
      (l) => l.code === selectedLgaCode || String(l.id) === selectedLgaCode
    );
  }, [lgasList, selectedLgaCode]);

  const selectedLgaId = useMemo(() => {
    return selectedLga ? selectedLga.id : null;
  }, [selectedLga]);

  const { data: apiWards = [], error: wardsError, refetch: refetchWards } = useGeographyWards(selectedLgaId);
  const wardsList = useMemo(() => {
    if (selectedLgaCode === "all") return [];
    return apiWards;
  }, [selectedLgaCode, apiWards]);

  const selectedWard = useMemo(() => {
    return wardsList.find(
      (w) => w.code === selectedWardCode || String(w.id) === selectedWardCode
    );
  }, [wardsList, selectedWardCode]);

  const selectedWardId = useMemo(() => {
    return selectedWard ? selectedWard.id : null;
  }, [selectedWard]);

  // 2. Fetch live coverage summary for header KPIs and tab counters
  const {
    data: summary,
    isLoading: isLoadingSummary,
    error: summaryError,
    refetch: refetchSummary,
  } = useCoverageSummary({
    stateId: selectedStateId ?? undefined,
    lgaId: selectedLgaId ?? undefined,
    wardId: selectedWardId ?? undefined,
  });

  // 3. Fetch live agents list
  const agentKindParam =
    selectedTypeTab === "official"
      ? "official"
      : selectedTypeTab === "extra"
      ? "extra"
      : undefined;

  const {
    data: agentsData,
    isLoading: isLoadingAgents,
    isFetching: isFetchingAgents,
    error: agentsError,
    refetch: refetchAgents,
  } = useAgents(
    {
      stateId: selectedStateId ?? undefined,
      lgaId: selectedLgaId ?? undefined,
      wardId: selectedWardId ?? undefined,
      agentKind: agentKindParam,
      limit: 100,
    },
    {
      enabled: selectedTypeTab !== "gaps",
    }
  );

  // 4. Fetch live coverage gaps (when viewing gaps or all records)
  const {
    data: gapsData,
    isLoading: isLoadingGaps,
    isFetching: isFetchingGaps,
    error: gapsError,
    refetch: refetchGaps,
  } = useCoverageGaps(
    {
      stateId: selectedStateId ?? undefined,
      lgaId: selectedLgaId ?? undefined,
      wardId: selectedWardId ?? undefined,
      limit: 100,
    },
    {
      enabled: selectedTypeTab === "gaps" || selectedTypeTab === "all",
    }
  );

  const router = useRouter();
  const queryErrors = [statesError, lgasError, wardsError, summaryError, agentsError, gapsError].filter(
    (e): e is NonNullable<typeof e> => Boolean(e)
  );
  const isUnauthorized = queryErrors.some((e) => (e as { status?: number }).status === 401);
  useEffect(() => {
    if (isUnauthorized) router.replace("/login");
  }, [isUnauthorized, router]);

  const handleRetry = () => {
    if (statesError) void refetchStates();
    if (lgasError) void refetchLgas();
    if (wardsError) void refetchWards();
    if (summaryError) void refetchSummary();
    if (agentsError) void refetchAgents();
    if (gapsError) void refetchGaps();
  };

  const isSyncing = isFetchingAgents || isFetchingGaps || isLoadingSummary;

  // 5. Build unified agent records list
  const allAgentRecords = useMemo<UnifiedAgentRecord[]>(() => {
    const list: UnifiedAgentRecord[] = [];

    // A. Map agents returned from API
    if (agentsData?.items && selectedTypeTab !== "gaps") {
      for (const item of agentsData.items) {
        const isOfficial = item.agentKind === "official";
        list.push({
          id: item.assignmentId,
          assignmentId: item.assignmentId,
          personId: item.personId,
          puId: item.pollingUnit.id,
          name: item.fullName,
          type: item.agentKind,
          sponsor: item.owner?.displayName || (isOfficial ? "Party Official" : "Candidate Campaign"),
          role: isOfficial
            ? "Official Party Agent"
            : item.slotNumber === 1
            ? "Protector"
            : item.slotNumber === 2
            ? "Mobiliser"
            : "Snapper",
          phoneMasked: item.maskedPhone || "—",
          puCode: item.pollingUnit.inecPollingUnitCode,
          puName: item.pollingUnit.name || `Polling Unit ${item.pollingUnit.inecPollingUnitCode}`,
          puLocation: `${item.pollingUnit.wardName}, ${item.pollingUnit.lgaName}`,
          wardCode: selectedWardCode !== "all" ? selectedWardCode : "",
          lgaCode: selectedLgaCode !== "all" ? selectedLgaCode : "",
          stateCode: selectedStateCode !== "all" ? selectedStateCode : "",
          wardName: item.pollingUnit.wardName,
          lgaName: item.pollingUnit.lgaName,
          stateName: item.pollingUnit.stateName,
        });
      }
    }

    // B. Map gaps returned from API (unassigned PUs)
    if (gapsData?.items && (selectedTypeTab === "gaps" || selectedTypeTab === "all")) {
      for (const gap of gapsData.items) {
        list.push({
          id: `gap-${gap.id}`,
          puId: gap.id,
          name: "Unassigned Agent Slot",
          type: "gap",
          sponsor: "Party Official (Vacant)",
          role: "Unassigned Official Agent",
          phoneMasked: "—",
          puCode: gap.code,
          puName: gap.name,
          puLocation: `${gap.ward.name}, ${gap.lga.name}`,
          latitude: gap.latitude,
          longitude: gap.longitude,
          hasGPS: gap.hasGPS,
          wardCode: gap.ward.code,
          lgaCode: gap.lga.code,
          stateCode: gap.state.code,
          wardName: gap.ward.name,
          lgaName: gap.lga.name,
          stateName: gap.state.name,
        });
      }
    }

    return list;
  }, [agentsData, gapsData, selectedTypeTab, selectedStateCode, selectedLgaCode, selectedWardCode]);

  // Tab counts driven by live coverage summary
  const counts = useMemo(() => {
    const covered = summary?.coveredPUs ?? 0;
    const extra = summary?.extraAgentsCount ?? 0;
    const gaps = summary?.noCoveragePUs ?? 0;
    return {
      all: covered + extra + gaps,
      official: covered,
      extra,
      gaps,
    };
  }, [summary]);

  // Filter records
  const filteredAgents = useMemo(() => {
    return allAgentRecords.filter((record) => {
      // Type Tab filter
      if (selectedTypeTab === "official" && record.type !== "official") return false;
      if (selectedTypeTab === "extra" && record.type !== "extra") return false;
      if (selectedTypeTab === "gaps" && record.type !== "gap") return false;

      // Sponsor filter
      if (selectedSponsor !== "all") {
        if (selectedSponsor === "Party" && !record.sponsor.toLowerCase().includes("party")) return false;
        if (selectedSponsor === "President" && !record.sponsor.toLowerCase().includes("president")) return false;
        if (selectedSponsor === "Senate" && !record.sponsor.toLowerCase().includes("senate")) return false;
        if (selectedSponsor === "House of Reps" && !record.sponsor.toLowerCase().includes("rep")) return false;
        if (selectedSponsor === "State Assembly" && !record.sponsor.toLowerCase().includes("assembly")) return false;
      }

      // Role filter
      if (selectedRole !== "all" && record.role !== selectedRole) return false;

      // Channel filter
      if (selectedChannel !== "all" && record.telegramStatus !== selectedChannel) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = record.name.toLowerCase().includes(q);
        const matchesPU = record.puName.toLowerCase().includes(q) || record.puCode.toLowerCase().includes(q);
        const matchesSponsor = record.sponsor.toLowerCase().includes(q);
        const matchesRole = record.role.toLowerCase().includes(q);
        if (!matchesName && !matchesPU && !matchesSponsor && !matchesRole) {
          return false;
        }
      }

      return true;
    });
  }, [
    allAgentRecords,
    selectedTypeTab,
    selectedSponsor,
    selectedRole,
    selectedChannel,
    searchQuery,
  ]);

  const handleResetFilters = () => {
    setSelectedTypeTab("all");
    resetAreaFilters();
    setSelectedSponsor("all");
    setSelectedRole("all");
    setSelectedChannel("all");
    setSearchQuery("");
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "PU Code,PU Name,Location,Agent Name,Agent Type,Sponsor/Owner,Role,Phone (Masked),Channel Status\n";

    filteredAgents.forEach((a) => {
      csvContent += `"${a.puCode}","${a.puName}","${a.puLocation}","${a.name}","${a.type}","${a.sponsor}","${a.role}","${a.phoneMasked}","${a.telegramStatus ?? ""}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ndc-agents-roster-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isUnauthorized) {
    return null;
  }

  if (queryErrors.length > 0) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-6 rounded-xl border border-border bg-card text-center space-y-3">
        <AlertCircle className="w-6 h-6 text-amber-600 mx-auto" />
        <p className="text-sm font-semibold text-foreground">Could not load agents data</p>
        <p className="text-xs text-muted-foreground">
          {(queryErrors[0] as Error).message || "The server did not respond. Try again."}
        </p>
        <Button size="sm" onClick={handleRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (isLoadingStates) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-xs text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading agents…
      </div>
    );
  }

  if (apiStates.length === 0) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-6 rounded-xl border border-border bg-card text-center space-y-2">
        <Users className="w-6 h-6 text-muted-foreground mx-auto" />
        <p className="text-sm font-semibold text-foreground">No polling units available</p>
        <p className="text-xs text-muted-foreground">
          Your account has no geography in scope, so there are no agents to show.
        </p>
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
              Polling Unit Agents Directory
            </h1>
            <Badge variant="outline" className="text-xs px-2 py-0.5 gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              1 Official Agent = Covered
            </Badge>
            {isSyncing ? (
              <Badge variant="secondary" className="text-[11px] px-2 py-0.5 gap-1 bg-muted/60 text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                Live Sync
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[11px] px-2 py-0.5 gap-1 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Live API Connected
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Monitor and coordinate official party agents and candidate-sponsored extra agents across polling units.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/broadcasts/new?group=agents"
            className="inline-flex items-center justify-center rounded-lg text-xs font-medium h-8 px-3.5 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Broadcast to Agents</span>
          </Link>
        </div>
      </div>

      {/* Top Metric Cards */}
      <AgentsKPISummary
        officialCount={counts.official}
        extraCount={counts.extra}
        gapsCount={counts.gaps}
        totalPUs={summary?.totalPUs ?? 0}
      />

      {/* Filter Bar */}
      <AgentsFilters
        selectedTypeTab={selectedTypeTab}
        setSelectedTypeTab={setSelectedTypeTab}
        selectedState={selectedStateCode}
        setSelectedState={setSelectedStateCode}
        selectedLga={selectedLgaCode}
        setSelectedLga={setSelectedLgaCode}
        selectedWard={selectedWardCode}
        setSelectedWard={setSelectedWardCode}
        selectedSponsor={selectedSponsor}
        setSelectedSponsor={setSelectedSponsor}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
        selectedChannel={selectedChannel}
        setSelectedChannel={setSelectedChannel}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        totalFilteredCount={filteredAgents.length}
        counts={counts}
        onReset={handleResetFilters}
        onExportCSV={handleExportCSV}
      />

      {/* Table */}
      <AgentsTable agents={filteredAgents} />
    </div>
  );
}
