"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/context/app-context";
import {
  useGeographyStates,
  useGeographyLgas,
  useGeographyWards,
  useGeographyPollingUnits,
} from "@/lib/hooks/use-geography";
import {
  useCoverageSummary,
  useCoverageGaps,
} from "@/lib/hooks/use-coverage";
import { StateData, LGAData, WardData, PollingUnitData } from "@/lib/types";
import { KPISummary } from "@/components/coverage/kpi-summary";
import { AtStakeCandidates } from "@/components/coverage/at-stake-candidates";
import { CoverageMap } from "@/components/coverage/coverage-map";
import { CoverageFilters } from "@/components/coverage/coverage-filters";
import { CoverageTable } from "@/components/coverage/coverage-table";
import { PoliticalUnitsView } from "@/components/coverage/political-units-view";
import {
  CoverageDashboardSkeleton,
  KPISummarySkeleton,
} from "@/components/coverage/coverage-skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Send,
  Download,
  Building,
  Layers,
  Sparkles,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

export default function CoveragePage() {
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

  const [unitMode, setUnitMode] = useState<"administrative" | "political">("administrative");
  const [filterMode, setFilterMode] = useState<"all" | "gaps">("all");
  const [sortBy, setSortBy] = useState<string>("pus-desc");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Determine current hierarchy level
  const currentLevel: "national" | "state" | "lga" | "ward" = useMemo(() => {
    if (selectedWardCode !== "all") return "ward";
    if (selectedLgaCode !== "all") return "lga";
    if (selectedStateCode !== "all") return "state";
    return "national";
  }, [selectedStateCode, selectedLgaCode, selectedWardCode]);

  // Fetch live geography data
  const {
    data: apiStates = [],
    isLoading: isLoadingStates,
    isFetching: isFetchingStates,
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

  const {
    data: apiPollingUnits = [],
    error: pusError,
    refetch: refetchPus,
  } = useGeographyPollingUnits(selectedWardId);

  // Live coverage summary query
  const {
    data: summaryData,
    isLoading: isLoadingSummary,
    isFetching: isFetchingSummary,
    error: summaryError,
    refetch: refetchSummary,
  } = useCoverageSummary({
    stateId: selectedStateId,
    lgaId: selectedLgaId,
    wardId: selectedWardId,
  });

  const levelName =
    currentLevel === "ward"
      ? selectedWard?.name || selectedWardCode
      : currentLevel === "lga"
      ? selectedLga?.name || selectedLgaCode
      : currentLevel === "state"
      ? selectedState?.name || selectedStateCode
      : "Nigeria";

  // KPI metrics come only from the live API summary
  const kpiData = useMemo(() => {
    if (!summaryData) return null;

    const statesCount = currentLevel === "national" ? apiStates.length : undefined;

    const lgasCount =
      currentLevel === "ward" || currentLevel === "lga"
        ? 1
        : currentLevel === "state"
        ? selectedState?.lgasCount ?? lgasList.length
        : apiStates.reduce((acc, s) => acc + (s.lgasCount ?? 0), 0);

    const wardsCount =
      currentLevel === "ward"
        ? 1
        : currentLevel === "lga"
        ? selectedLga?.wardsCount ?? wardsList.length
        : currentLevel === "state"
        ? selectedState?.wardsCount ?? lgasList.reduce((acc, l) => acc + l.wardsCount, 0)
        : apiStates.reduce((acc, s) => acc + (s.wardsCount ?? 0), 0);

    return {
      levelName,
      totalPUs: summaryData.totalPUs,
      gpsPUs: summaryData.gpsPUs,
      coveredPUs: summaryData.coveredPUs,
      noCoveragePUs: summaryData.noCoveragePUs,
      officialAgentPct: summaryData.officialAgentPct,
      extraAgentsCount: summaryData.extraAgentsCount,
      wardsCount,
      lgasCount,
      statesCount,
    };
  }, [
    summaryData,
    currentLevel,
    levelName,
    selectedLga,
    selectedState,
    apiStates,
    lgasList,
    wardsList,
  ]);

  // Filter and sort States data (live or static)
  const filteredStates: StateData[] = useMemo(() => {
    let result: StateData[] = statesList.map((s) => {
      const covered = s.coveredPUs;
      const total = s.totalPUs;
      const pct = s.officialAgentPct;
      const status: "Open" | "Complete" | "Critical" =
        pct === 100 ? "Complete" : pct < 20 ? "Critical" : "Open";

      return {
        code: s.code,
        name: s.name,
        totalPUs: total,
        gpsPUs: s.gpsPUs,
        coveredPUs: covered,
        noCoveragePUs: s.noCoveragePUs,
        officialAgentPct: pct,
        extraAgentsCount: s.extraAgentsCount,
        lgasCount: s.lgasCount ?? 0,
        wardsCount: s.wardsCount ?? 0,
        status,
      };
    });

    if (filterMode === "gaps") {
      result = result.filter((s) => s.noCoveragePUs > 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || s.code.includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "pus-desc") return b.totalPUs - a.totalPUs;
      if (sortBy === "pus-asc") return a.totalPUs - b.totalPUs;
      if (sortBy === "coverage-desc") return b.officialAgentPct - a.officialAgentPct;
      if (sortBy === "coverage-asc") return a.officialAgentPct - b.officialAgentPct;
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      return 0;
    });

    return result;
  }, [statesList, filterMode, searchQuery, sortBy]);

  // Filter and sort LGAs data (live or static)
  const filteredLGAs: LGAData[] = useMemo(() => {
    let result: LGAData[] = lgasList.map((l) => {
      const pct = l.officialAgentPct;
      const status: "Open" | "Complete" | "Critical" =
        pct === 100 ? "Complete" : pct < 20 ? "Critical" : "Open";

      return {
        code: l.code,
        stateCode: "stateCode" in l ? String(l.stateCode) : selectedStateCode,
        name: l.name,
        totalPUs: l.totalPUs,
        gpsPUs: l.gpsPUs,
        coveredPUs: l.coveredPUs,
        noCoveragePUs: l.noCoveragePUs,
        officialAgentPct: pct,
        extraAgentsCount: l.extraAgentsCount,
        wardsCount: l.wardsCount,
        status,
      };
    });

    if (filterMode === "gaps") {
      result = result.filter((l) => l.noCoveragePUs > 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (l) => l.name.toLowerCase().includes(q) || l.code.includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "pus-desc") return b.totalPUs - a.totalPUs;
      if (sortBy === "pus-asc") return a.totalPUs - b.totalPUs;
      if (sortBy === "coverage-desc") return b.officialAgentPct - a.officialAgentPct;
      if (sortBy === "coverage-asc") return a.officialAgentPct - b.officialAgentPct;
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      return 0;
    });

    return result;
  }, [lgasList, selectedStateCode, filterMode, searchQuery, sortBy]);

  // Filter and sort Wards data (live or static)
  const filteredWards: WardData[] = useMemo(() => {
    let result: WardData[] = wardsList.map((w) => {
      const pct = w.officialAgentPct;
      const status: "Open" | "Complete" | "Critical" =
        pct === 100 ? "Complete" : pct < 20 ? "Critical" : "Open";

      return {
        code: w.code,
        lgaCode: "lgaCode" in w ? String(w.lgaCode) : selectedLgaCode,
        stateCode: "stateCode" in w ? String(w.stateCode) : selectedStateCode,
        name: w.name,
        totalPUs: w.totalPUs,
        gpsPUs: w.gpsPUs,
        coveredPUs: w.coveredPUs,
        noCoveragePUs: w.noCoveragePUs,
        officialAgentPct: pct,
        extraAgentsCount: w.extraAgentsCount,
        status,
      };
    });

    if (filterMode === "gaps") {
      result = result.filter((w) => w.noCoveragePUs > 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (w) => w.name.toLowerCase().includes(q) || w.code.includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "pus-desc") return b.totalPUs - a.totalPUs;
      if (sortBy === "pus-asc") return a.totalPUs - b.totalPUs;
      if (sortBy === "coverage-desc") return b.officialAgentPct - a.officialAgentPct;
      if (sortBy === "coverage-asc") return a.officialAgentPct - b.officialAgentPct;
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      return 0;
    });

    return result;
  }, [wardsList, selectedLgaCode, filterMode, searchQuery, sortBy]);

  // Polling units come only from the live ward polling-units API
  const pollingUnitsList: PollingUnitData[] = useMemo(() => {
    return apiPollingUnits.map((p) => {
      const officialAgent = p.agents.find((agent) => agent.agentKind === "official");
      const extraAgents = p.agents
        .filter((agent) => agent.agentKind === "extra")
        .map((agent) => ({
          id: agent.assignmentId,
          assignmentId: agent.assignmentId,
          name: agent.fullName,
          phone: agent.maskedPhone ?? undefined,
          role: agent.agentKind,
          owner: agent.owner.displayName,
        }));

      return {
        id: p.id,
        code: p.code,
        name: p.name,
        wardCode: p.wardCode || selectedWardCode,
        lgaCode: p.lgaCode || selectedLgaCode,
        stateCode: p.stateCode || selectedStateCode,
        latitude: p.latitude ?? 0,
        longitude: p.longitude ?? 0,
        hasGPS: p.latitude !== null && p.longitude !== null,
        hasOfficialAgent: Boolean(p.hasOfficialAgent),
        officialAgentName: officialAgent?.fullName,
        officialAgentPhone: officialAgent?.maskedPhone ?? undefined,
        officialAssignmentId: officialAgent?.assignmentId,
        extraAgents,
        location:
          p.locationDescription || `${p.name}, Ward ${selectedWard?.name || selectedWardCode}`,
      };
    });
  }, [apiPollingUnits, selectedWardCode, selectedLgaCode, selectedStateCode, selectedWard]);

  const filteredPollingUnits: PollingUnitData[] = useMemo(() => {
    let result = [...pollingUnitsList];

    if (filterMode === "gaps") {
      result = result.filter((p) => !p.hasOfficialAgent);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.includes(q) ||
          p.location.toLowerCase().includes(q)
      );
    }

    return result;
  }, [pollingUnitsList, filterMode, searchQuery]);

  const isLiveSyncing = isFetchingStates || isFetchingSummary;

  const router = useRouter();
  const queryErrors = [statesError, lgasError, wardsError, pusError, summaryError].filter(
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
    if (pusError) void refetchPus();
    if (summaryError) void refetchSummary();
  };

  if (isUnauthorized) {
    return null;
  }

  if (queryErrors.length > 0) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-6 rounded-xl border border-border bg-card text-center space-y-3">
        <AlertCircle className="w-6 h-6 text-amber-600 mx-auto" />
        <p className="text-sm font-semibold text-foreground">Could not load coverage data</p>
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
    return <CoverageDashboardSkeleton />;
  }

  if (apiStates.length === 0) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-6 rounded-xl border border-border bg-card text-center space-y-2">
        <Building className="w-6 h-6 text-muted-foreground mx-auto" />
        <p className="text-sm font-semibold text-foreground">No polling units available</p>
        <p className="text-xs text-muted-foreground">
          Your account has no geography in scope, so there is no coverage to show.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              2027 Coverage Dashboard
            </h1>
            <Badge
              variant="outline"
              className="text-xs px-2 py-0.5 gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300"
            >
              {isLiveSyncing ? (
                <Loader2 className="w-3 h-3 text-emerald-600 animate-spin" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
              <span>Live INEC Engine</span>
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Monitor real-time official party agent deployment
            {kpiData ? ` across ${kpiData.totalPUs.toLocaleString()} polling units in view.` : "."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/broadcasts/new?target=${encodeURIComponent(levelName)}`}
            className="inline-flex items-center justify-center rounded-lg text-xs font-medium h-8 px-3 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Broadcast to this Area</span>
          </Link>
        </div>
      </div>

      {/* Filter and Hierarchy Switcher Bar */}
      <CoverageFilters
        unitMode={unitMode}
        setUnitMode={setUnitMode}
        stateCode={selectedStateCode}
        setStateCode={setSelectedStateCode}
        lgaCode={selectedLgaCode}
        setLgaCode={setSelectedLgaCode}
        wardCode={selectedWardCode}
        setWardCode={setSelectedWardCode}
        filterMode={filterMode}
        setFilterMode={setFilterMode}
        sortBy={sortBy}
        setSortBy={setSortBy}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activePersona={activePersona}
        totalPUsCount={kpiData?.totalPUs ?? 0}
        gapsCount={kpiData?.noCoveragePUs ?? 0}
        onReset={resetAreaFilters}
      />

      {/* Top Metric Cards */}
      {isLoadingSummary && !kpiData ? (
        <KPISummarySkeleton />
      ) : kpiData ? (
        <KPISummary
          levelName={kpiData.levelName}
          totalPUs={kpiData.totalPUs}
          gpsPUs={kpiData.gpsPUs}
          coveredPUs={kpiData.coveredPUs}
          noCoveragePUs={kpiData.noCoveragePUs}
          officialAgentPct={kpiData.officialAgentPct}
          extraAgentsCount={kpiData.extraAgentsCount}
          lgasCount={kpiData.lgasCount}
          wardsCount={kpiData.wardsCount}
          statesCount={kpiData.statesCount}
        />
      ) : null}
      {/* "At stake here" Candidate Cards */}
      <AtStakeCandidates
        stateCode={selectedStateCode}
        lgaCode={selectedLgaCode}
        wardCode={selectedWardCode}
      />

      {/* MAIN VIEW MODE: Administrative (Map & Table) vs Political */}
      {unitMode === "administrative" ? (
        <div className="space-y-5">
          {/* Geographic Visualizer Map */}
          <CoverageMap
            stateCode={selectedStateCode}
            lgaCode={selectedLgaCode}
            wardCode={selectedWardCode}
            stateName={selectedState?.name}
            lgaName={selectedLga?.name}
            wardName={selectedWard?.name}
            states={statesList}
            lgas={lgasList}
            wards={wardsList}
            pollingUnits={pollingUnitsList}
            onSelectState={(code) => {
              setSelectedStateCode(code);
              setSelectedLgaCode("all");
              setSelectedWardCode("all");
            }}
            onSelectLga={(code) => {
              setSelectedLgaCode(code);
              setSelectedWardCode("all");
            }}
            onSelectWard={(code) => setSelectedWardCode(code)}
          />

          {/* Drilldown Dual Data Table */}
          <CoverageTable
            level={currentLevel}
            states={filteredStates}
            lgas={filteredLGAs}
            wards={filteredWards}
            pollingUnits={filteredPollingUnits}
            onOpenState={(code) => {
              setSelectedStateCode(code);
              setSelectedLgaCode("all");
              setSelectedWardCode("all");
            }}
            onOpenLga={(code) => {
              setSelectedLgaCode(code);
              setSelectedWardCode("all");
            }}
            onOpenWard={(code) => setSelectedWardCode(code)}
          />
        </div>
      ) : (
        /* Political Units Hierarchical Races View */
        <PoliticalUnitsView />
      )}
    </div>
  );
}
