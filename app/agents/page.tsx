"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/context/app-context";
import {
  useGeographyStates,
  useGeographyLgas,
  useGeographyWards,
} from "@/lib/hooks/use-geography";
import { useCoverageSummary, useCoverageGaps } from "@/lib/hooks/use-coverage";
import { useAgents } from "@/lib/hooks/use-agents";
import { AgentsKPISummary } from "@/components/agents/agents-kpi-summary";
import { AgentsFilters, type AgentTypeFilter } from "@/components/agents/agents-filters";
import { AgentsTable } from "@/components/agents/agents-table";
import { UnifiedAgentRecord } from "@/components/agents/agent-detail-modal";
import { AgentsDirectorySkeleton } from "@/components/agents/agents-skeletons";
import { toTitleCase } from "@/components/candidates/candidates-filters";
import { Button } from "@/components/ui/button";
import { Users, Send, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";

export default function AgentsPage() {
  const {
    selectedStateCode,
    setSelectedStateCode,
    selectedLgaCode,
    setSelectedLgaCode,
    selectedWardCode,
    setSelectedWardCode,
    resetAreaFilters,
  } = useApp();

  // Type = the agent kind stored on the assignment; "all" also lists gaps.
  const [selectedTypeTab, setSelectedTypeTab] = useState<AgentTypeFilter>("all");
  const [selectedSponsor, setSelectedSponsor] = useState<string>("all");
  // The channel filter is not in the current design.
  const [selectedChannel] = useState<string>("all");
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
      (s) => s.code === selectedStateCode || String(s.id) === selectedStateCode,
    );
  }, [statesList, selectedStateCode]);

  const selectedStateId = useMemo(() => {
    return selectedState ? selectedState.id : null;
  }, [selectedState]);

  const {
    data: apiLgas = [],
    error: lgasError,
    refetch: refetchLgas,
  } = useGeographyLgas(selectedStateId);
  const lgasList = useMemo(() => {
    if (selectedStateCode === "all") return [];
    return apiLgas;
  }, [selectedStateCode, apiLgas]);

  const selectedLga = useMemo(() => {
    return lgasList.find(
      (l) => l.code === selectedLgaCode || String(l.id) === selectedLgaCode,
    );
  }, [lgasList, selectedLgaCode]);

  const selectedLgaId = useMemo(() => {
    return selectedLga ? selectedLga.id : null;
  }, [selectedLga]);

  const {
    data: apiWards = [],
    error: wardsError,
    refetch: refetchWards,
  } = useGeographyWards(selectedLgaId);
  const wardsList = useMemo(() => {
    if (selectedLgaCode === "all") return [];
    return apiWards;
  }, [selectedLgaCode, apiWards]);

  const selectedWard = useMemo(() => {
    return wardsList.find(
      (w) => w.code === selectedWardCode || String(w.id) === selectedWardCode,
    );
  }, [wardsList, selectedWardCode]);

  const selectedWardId = useMemo(() => {
    return selectedWard ? selectedWard.id : null;
  }, [selectedWard]);

  // 2. Fetch live coverage summary for header KPIs and tab counters
  const {
    data: summary,
    isLoading: isLoadingSummary,
    isFetching: isFetchingSummary,
    error: summaryError,
    refetch: refetchSummary,
  } = useCoverageSummary({
    stateId: selectedStateId ?? undefined,
    lgaId: selectedLgaId ?? undefined,
    wardId: selectedWardId ?? undefined,
  });

  // Sponsor / owner is an owner group id, applied by the agents API.
  const ownerGroupId = selectedSponsor === "all" ? undefined : Number(selectedSponsor);

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
      ownerGroupId,
      limit: 100,
    },
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
      // Gaps are not agents and have no owner: they show only with Any type and Anyone.
      enabled: selectedTypeTab === "all" && ownerGroupId === undefined,
    },
  );

  const router = useRouter();
  const queryErrors = [
    statesError,
    lgasError,
    wardsError,
    summaryError,
    agentsError,
    gapsError,
  ].filter((e): e is NonNullable<typeof e> => Boolean(e));
  const isUnauthorized = queryErrors.some(
    (e) => (e as { status?: number }).status === 401,
  );
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

  const isSyncing = isFetchingAgents || isFetchingGaps || isFetchingSummary;

  // 5. Build unified agent records list
  const allAgentRecords = useMemo<UnifiedAgentRecord[]>(() => {
    const list: UnifiedAgentRecord[] = [];

    // A. Map agents returned from API
    if (agentsData?.items) {
      for (const item of agentsData.items) {
        const isOfficial = item.agentKind === "official";
        list.push({
          id: item.assignmentId,
          assignmentId: item.assignmentId,
          personId: item.personId,
          puId: item.pollingUnit.id,
          name: item.fullName,
          type: item.agentKind,
          sponsor:
            item.owner?.displayName ||
            (isOfficial ? "Party Official" : "Candidate Campaign"),
          // No role is stored yet (PRD: extras are tagged by owner only), so show the kind.
          role: isOfficial ? "Official agent" : "Extra agent",
          phoneMasked: item.maskedPhone || "—",
          telegramStatus: item.telegramConnected ? "connected" : undefined,
          puCode: item.pollingUnit.inecPollingUnitCode,
          puName:
            item.pollingUnit.name ||
            `Polling Unit ${item.pollingUnit.inecPollingUnitCode}`,
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
    if (gapsData?.items && selectedTypeTab === "all" && ownerGroupId === undefined) {
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
  }, [
    agentsData,
    gapsData,
    selectedTypeTab,
    selectedStateCode,
    selectedLgaCode,
    selectedWardCode,
    ownerGroupId,
  ]);

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
      if (selectedTypeTab === "official" && record.type !== "official")
        return false;
      if (selectedTypeTab === "extra" && record.type !== "extra") return false;

      // Sponsor / owner is applied by the agents API (ownerGroupId).

      // Channel filter
      if (
        selectedChannel !== "all" &&
        record.telegramStatus !== selectedChannel
      )
        return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = record.name.toLowerCase().includes(q);
        const matchesPU =
          record.puName.toLowerCase().includes(q) ||
          record.puCode.toLowerCase().includes(q);
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
    selectedChannel,
    searchQuery,
  ]);

  const handleClearFilters = () => {
    resetAreaFilters();
    setSelectedSponsor("all");
    setSelectedTypeTab("all");
    setSearchQuery("");
  };

  const areaName = toTitleCase(
    selectedWard?.name ?? selectedLga?.name ?? selectedState?.name ?? "Nigeria",
  );

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent +=
      "PU Code,PU Name,Location,Agent Name,Agent Type,Sponsor/Owner,Role,Phone (Masked),Channel Status\n";

    filteredAgents.forEach((a) => {
      csvContent += `"${a.puCode}","${a.puName}","${a.puLocation}","${a.name}","${a.type}","${a.sponsor}","${a.role}","${a.phoneMasked}","${a.telegramStatus === "connected" ? "Telegram Connected" : a.type === "gap" ? "" : "Not available yet"}"\n`;
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
        <p className="text-sm font-semibold text-foreground">
          Could not load agents data
        </p>
        <p className="text-xs text-muted-foreground">
          {(queryErrors[0] as Error).message ||
            "The server did not respond. Try again."}
        </p>
        <Button size="sm" onClick={handleRetry}>
          Retry
        </Button>
      </div>
    );
  }

  const isInitialLoading =
    isLoadingStates ||
    ((isLoadingAgents || isLoadingGaps || isLoadingSummary) &&
      allAgentRecords.length === 0 &&
      !summary);

  if (isInitialLoading) {
    return <AgentsDirectorySkeleton />;
  }

  if (apiStates.length === 0) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-6 rounded-xl border border-border bg-card text-center space-y-2">
        <Users className="w-6 h-6 text-muted-foreground mx-auto" />
        <p className="text-sm font-semibold text-foreground">
          No polling units available
        </p>
        <p className="text-xs text-muted-foreground">
          Your account has no geography in scope, so there are no agents to
          show.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            Polling Unit Agents Directory
          </h1>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
            One row per agent record · coverage = one official party agent at the unit
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={handleExportCSV} className="h-8 px-3 text-xs">
            Export CSV
          </Button>
          <Link
            href="/broadcasts/new?group=agents"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Message these agents</span>
          </Link>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div
        aria-busy={isFetchingSummary}
        className={`transition-opacity ${isFetchingSummary ? "opacity-60" : ""}`}
      >
        <AgentsKPISummary
          totalPUs={summary?.totalPUs ?? 0}
          officialCount={counts.official}
          extraCount={counts.extra}
          gapsCount={counts.gaps}
          areaName={areaName}
        />
      </div>

      <AgentsFilters
          selectedState={selectedStateCode}
          setSelectedState={setSelectedStateCode}
          selectedLga={selectedLgaCode}
          setSelectedLga={setSelectedLgaCode}
          selectedWard={selectedWardCode}
          setSelectedWard={setSelectedWardCode}
          selectedSponsor={selectedSponsor}
          setSelectedSponsor={setSelectedSponsor}
          selectedType={selectedTypeTab}
          setSelectedType={setSelectedTypeTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          totalFilteredCount={filteredAgents.length}
          isRefreshing={isSyncing}
          onClear={handleClearFilters}
        />

      <section
        aria-busy={isSyncing}
        className="relative min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card p-3 sm:p-4"
      >
        <div className={`transition-opacity ${isSyncing ? "pointer-events-none opacity-40" : ""}`}>
          <AgentsTable agents={filteredAgents} />
        </div>
        {isSyncing && (
          <div role="status" className="absolute inset-0 z-10 flex items-center justify-center">
            <span className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Loading agents…
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
