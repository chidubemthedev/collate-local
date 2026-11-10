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
import { toTitleCase } from "@/components/candidates/candidates-filters";
import { WF, PageHeader, LoadingBox, CenterSpinner, CountTabs } from "@/components/ui/wf";
import { Users, Send, AlertCircle } from "lucide-react";
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
  // Searched on the server (agent name, PU code, ...) once typing pauses.
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchQuery.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const q = search || undefined;

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
      q,
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
      q,
      limit: 100,
    },
    {
      // Gaps are not agents and have no owner: they show only with All records or Gaps, and Anyone.
      enabled: (selectedTypeTab === "all" || selectedTypeTab === "gaps") && ownerGroupId === undefined,
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
          latitude: item.pollingUnit.latitude,
          longitude: item.pollingUnit.longitude,
          hasGPS: item.pollingUnit.hasGps,
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
    if (gapsData?.items && (selectedTypeTab === "all" || selectedTypeTab === "gaps") && ownerGroupId === undefined) {
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
      if (selectedTypeTab === "gaps" && record.type !== "gap") return false;

      // Sponsor / owner is applied by the agents API (ownerGroupId).

      // Channel filter
      if (
        selectedChannel !== "all" &&
        record.telegramStatus !== selectedChannel
      )
        return false;

      // Search is applied by the APIs (q).

      return true;
    });
  }, [
    allAgentRecords,
    selectedTypeTab,
    selectedChannel,
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
      <div className={`${WF.card} mx-auto mt-16 max-w-xl space-y-3 p-6 text-center`}>
        <AlertCircle className="mx-auto h-6 w-6 text-[#B45309]" />
        <p className="text-[14px] font-semibold text-[#0A0A0A]">Could not load agents data</p>
        <p className="text-[12px] text-[#737373]">
          {(queryErrors[0] as Error).message || "The server did not respond. Try again."}
        </p>
        <button type="button" className={WF.btnDark} onClick={handleRetry}>
          Retry
        </button>
      </div>
    );
  }

  const isInitialLoading =
    isLoadingStates ||
    ((isLoadingAgents || isLoadingGaps || isLoadingSummary) &&
      allAgentRecords.length === 0 &&
      !summary);

  if (isInitialLoading) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Polling Unit Agents Directory" subtitle="Loading…" />
        <LoadingBox>Loading agents…</LoadingBox>
      </div>
    );
  }

  if (apiStates.length === 0) {
    return (
      <div className={`${WF.card} mx-auto mt-16 max-w-xl space-y-2 p-6 text-center`}>
        <Users className="mx-auto h-6 w-6 text-[#737373]" />
        <p className="text-[14px] font-semibold text-[#0A0A0A]">No polling units available</p>
        <p className="text-[12px] text-[#737373]">
          Your account has no geography in scope, so there are no agents to
          show.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 text-[#0A0A0A] sm:gap-4">
      <PageHeader
        title="Polling Unit Agents Directory"
        subtitle="One row per agent record · coverage = one official party agent at the unit"
        actions={
          <>
            <button type="button" onClick={handleExportCSV} className={WF.btnOutline}>
              Export CSV
            </button>
            <Link href="/broadcasts/new?group=agents" className={WF.btnDark}>
              <Send className="h-3.5 w-3.5" />
              Message these agents
            </Link>
          </>
        }
      />

      <div aria-busy={isFetchingSummary} className={`transition-opacity ${isFetchingSummary ? "opacity-60" : ""}`}>
        <AgentsKPISummary
          totalPUs={summary?.totalPUs ?? 0}
          officialCount={counts.official}
          extraCount={counts.extra}
          gapsCount={counts.gaps}
          areaName={areaName}
        />
      </div>

      <CountTabs<AgentTypeFilter>
        label="Records"
        value={selectedTypeTab}
        onChange={setSelectedTypeTab}
        dim={isFetchingSummary}
        tabs={[
          { id: "all", label: "All records", count: counts.all },
          { id: "official", label: "Official", count: counts.official },
          { id: "extra", label: "Extra", count: counts.extra },
          { id: "gaps", label: "Gaps", count: counts.gaps },
        ]}
      />

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

      <section aria-busy={isSyncing} className="relative min-w-0">
        <CenterSpinner show={isSyncing} />
        <div className={`transition-opacity ${isSyncing ? "pointer-events-none opacity-40" : ""}`}>
          <AgentsTable agents={filteredAgents} />
        </div>
      </section>

      <p className={WF.note}>
        * Sponsors: NDC (the party) for the one official agent per unit; extra agents belong to support groups and
        candidates and never change coverage.
      </p>
    </div>
  );
}
