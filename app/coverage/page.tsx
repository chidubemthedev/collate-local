"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/context/app-context";
import {
  useGeographyStates,
  useGeographyState,
  useGeographyLgas,
  useGeographyWards,
  useGeographyPollingUnits,
  type PollingUnitFilterParams,
} from "@/lib/hooks/use-geography";
import {
  useCoverageSummary,
  useCoverageMapPoints,
  useCandidateCoverage,
} from "@/lib/hooks/use-coverage";
import { StateData, LGAData, WardData, PollingUnitData } from "@/lib/types";
import { KPISummary } from "@/components/coverage/kpi-summary";
import { AtStakeCandidates } from "@/components/coverage/at-stake-candidates";
import { CoverageMap } from "@/components/coverage/coverage-map";
import { CoverageFilters, type CoverageFilterMode, type CoverageViewBy } from "@/components/coverage/coverage-filters";
import { CoverageTable } from "@/components/coverage/coverage-table";
import { Send, Building, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WF, PageHeader, LoadingBox, CenterSpinner } from "@/components/ui/wf";
import type { CoverageMapPoint } from "@/types/api";

// One shared empty list, so the map sees the same array while nothing is loaded.
const NO_MAP_POINTS: CoverageMapPoint[] = [];

interface SortableRow {
  code: string;
  totalPUs: number;
  noCoveragePUs: number;
  officialAgentPct: number;
  extraAgentsCount: number;
}

function compareRows(sortBy: string) {
  return (a: SortableRow, b: SortableRow) => {
    if (sortBy === "pus-desc") return b.totalPUs - a.totalPUs;
    if (sortBy === "gaps-desc") return b.noCoveragePUs - a.noCoveragePUs;
    if (sortBy === "coverage-asc") return a.officialAgentPct - b.officialAgentPct;
    if (sortBy === "extra-desc") return b.extraAgentsCount - a.extraAgentsCount;
    return a.code.localeCompare(b.code, undefined, { numeric: true });
  };
}

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

  const [filterMode, setFilterMode] = useState<CoverageFilterMode>("all");
  const [sortBy, setSortBy] = useState<string>("inec");
  const [viewBy, setViewBy] = useState<CoverageViewBy>("administrative");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Determine current hierarchy level
  const currentLevel: "national" | "state" | "lga" | "ward" = useMemo(() => {
    if (selectedWardCode !== "all") return "ward";
    if (selectedLgaCode !== "all") return "lga";
    if (selectedStateCode !== "all") return "state";
    return "national";
  }, [selectedStateCode, selectedLgaCode, selectedWardCode]);

  // The pills are applied by the API, so the filter goes with every request.
  const puFilter = useMemo<PollingUnitFilterParams>(() => {
    if (filterMode === "gaps") return { coverage: "gaps" };
    if (filterMode === "gps") return { gps: "with" };
    if (filterMode === "no-gps") return { gps: "without" };
    return {};
  }, [filterMode]);

  // Fetch live geography data
  const {
    data: apiStates = [],
    isLoading: isLoadingStates,
    error: statesError,
    refetch: refetchStates,
  } = useGeographyStates(puFilter);

  const statesList = apiStates;

  const selectedState = useMemo(() => {
    return statesList.find(
      (s) => s.code === selectedStateCode || String(s.id) === selectedStateCode
    );
  }, [statesList, selectedStateCode]);

  const selectedStateId = useMemo(() => {
    return selectedState ? selectedState.id : null;
  }, [selectedState]);

  const {
    data: apiLgas = [],
    isLoading: isLoadingLgas,
    isFetching: isFetchingLgas,
    error: lgasError,
    refetch: refetchLgas,
  } = useGeographyLgas(selectedStateId, puFilter);

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

  const {
    data: apiWards = [],
    isLoading: isLoadingWards,
    isFetching: isFetchingWards,
    error: wardsError,
    refetch: refetchWards,
  } = useGeographyWards(selectedLgaId, puFilter);

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

  // An office choice only applies to the area it was made in.
  const areaKey = `${selectedStateId ?? ""}-${selectedLgaId ?? ""}-${selectedWardId ?? ""}`;
  const [officeChoice, setOfficeChoice] = useState<{ areaKey: string; officeId: number | null }>({
    areaKey,
    officeId: null,
  });
  const selectedOfficeId =
    viewBy === "political" && officeChoice.areaKey === areaKey ? officeChoice.officeId : null;
  const setSelectedOfficeId = (officeId: number | null) => setOfficeChoice({ areaKey, officeId });
  // The offices list must not depend on the chosen office, or picking one refetches and reloads the dropdown.
  const candidateQuery = useCandidateCoverage({
    stateId: selectedStateId,
    lgaId: selectedLgaId,
    wardId: selectedWardId,
  });
  const candidateOffices = candidateQuery.data?.pages[0]?.offices ?? [];
  const officesLoading = candidateQuery.isFetching && !candidateQuery.isFetchingNextPage;

  const {
    data: apiPollingUnits = [],
    isLoading: isLoadingPollingUnits,
    isFetching: isFetchingPollingUnits,
    error: pusError,
    refetch: refetchPus,
  } = useGeographyPollingUnits(selectedWardId, puFilter.gps);

  // Live coverage summary query
  const isStateDetailEnabled =
    currentLevel === "state" && selectedStateId !== null && filterMode === "all";
  const stateDetailQuery = useGeographyState(isStateDetailEnabled ? selectedStateId : null);
  const coverageSummaryQuery = useCoverageSummary({
    stateId: selectedStateId,
    lgaId: selectedLgaId,
    wardId: selectedWardId,
    ...puFilter,
  }, {
    enabled: !isStateDetailEnabled,
  });
  // Points are only downloaded when the map view draws them (Hexagons / Points); the default
  // Areas view needs none, and the national list is ~130k points.
  const [mapNeedsPoints, setMapNeedsPoints] = useState(false);
  const coordinatesEnabled =
    (selectedStateCode === "all" || selectedStateId !== null) &&
    (selectedLgaCode === "all" || selectedLgaId !== null) &&
    (selectedWardCode === "all" || selectedWardId !== null);
  const coordinatePointsQuery = useCoverageMapPoints(
    {
      stateId: selectedStateId,
      lgaId: selectedLgaId,
      wardId: selectedWardId,
    },
    { enabled: coordinatesEnabled && mapNeedsPoints },
  );
  const summaryData = isStateDetailEnabled ? stateDetailQuery.data : coverageSummaryQuery.data;
  const isLoadingSummary = isStateDetailEnabled
    ? stateDetailQuery.isLoading
    : coverageSummaryQuery.isLoading;
  const isFetchingSummary = isStateDetailEnabled
    ? stateDetailQuery.isFetching
    : coverageSummaryQuery.isFetching;
  const summaryError = isStateDetailEnabled
    ? stateDetailQuery.error
    : coverageSummaryQuery.error;
  const refetchSummary = isStateDetailEnabled
    ? stateDetailQuery.refetch
    : coverageSummaryQuery.refetch;

  const levelName =
    currentLevel === "ward"
      ? selectedWard?.name || selectedWardCode
      : currentLevel === "lga"
      ? selectedLga?.name || selectedLgaCode
      : currentLevel === "state"
      ? selectedState?.name || selectedStateCode
      : "Nigeria";

  const filterModeLabel: Record<CoverageFilterMode, string> = {
    all: "",
    gaps: "Gaps only",
    gps: "With GPS",
    "no-gps": "No GPS",
  };
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

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || s.code.includes(q)
      );
    }

    // Sort
    result.sort(compareRows(sortBy));

    return result;
  }, [statesList, searchQuery, sortBy]);

  // Filter and sort LGAs data (live or static)
  const filteredLGAs: LGAData[] = useMemo(() => {
    let result: LGAData[] = lgasList.map((l) => {
      const pct = l.officialAgentPct;
      const status: "Open" | "Complete" | "Critical" =
        pct === 100 ? "Complete" : pct < 20 ? "Critical" : "Open";

      return {
        code: l.code,
        stateCode: "inecStateCode" in l ? l.inecStateCode : selectedStateCode,
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

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (l) => l.name.toLowerCase().includes(q) || l.code.includes(q)
      );
    }

    // Sort
    result.sort(compareRows(sortBy));

    return result;
  }, [lgasList, selectedStateCode, searchQuery, sortBy]);

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

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (w) => w.name.toLowerCase().includes(q) || w.code.includes(q)
      );
    }

    // Sort
    result.sort(compareRows(sortBy));

    return result;
  }, [wardsList, selectedLgaCode, selectedStateCode, searchQuery, sortBy]);

  // Areas one level down, coloured on the map (all of them, ignoring the table search).
  const mapAreaStats = useMemo(() => {
    const list = currentLevel === "national" ? statesList : currentLevel === "state" ? lgasList : wardsList;
    return list.map((area) => ({
      code: area.code,
      name: area.name,
      totalPUs: area.totalPUs,
      coveredPUs: area.coveredPUs,
    }));
  }, [currentLevel, statesList, lgasList, wardsList]);

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

  const isCoverageTableLoading =
    (currentLevel === "state" && isLoadingLgas) ||
    (currentLevel === "lga" && isLoadingWards) ||
    (currentLevel === "ward" && isLoadingPollingUnits);
  const isCoverageTableFetching =
    (currentLevel === "state" && isFetchingLgas) ||
    (currentLevel === "lga" && isFetchingWards) ||
    (currentLevel === "ward" && isFetchingPollingUnits);

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
      <div className={`${WF.card} mx-auto mt-16 max-w-xl space-y-3 p-6 text-center`}>
        <AlertCircle className="mx-auto h-6 w-6 text-[#B45309]" />
        <p className="text-[14px] font-semibold text-[#0A0A0A]">Could not load coverage data</p>
        <p className="text-[12px] text-[#737373]">
          {(queryErrors[0] as Error).message || "The server did not respond. Try again."}
        </p>
        <button type="button" className={WF.btnDark} onClick={handleRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (isLoadingStates) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#737373]" aria-label="Loading coverage" />
      </div>
    );
  }

  if (apiStates.length === 0) {
    return (
      <div className={`${WF.card} mx-auto mt-16 max-w-xl space-y-2 p-6 text-center`}>
        <Building className="mx-auto h-6 w-6 text-[#737373]" />
        <p className="text-[14px] font-semibold text-[#0A0A0A]">No polling units available</p>
        <p className="text-[12px] text-[#737373]">
          Your account has no geography in scope, so there is no coverage to show.
        </p>
      </div>
    );
  }

  const coverageFilters = (
    <CoverageFilters
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
      viewBy={viewBy}
      setViewBy={(next) => {
        setViewBy(next);
        setSelectedLgaCode("all");
        setSelectedWardCode("all");
        setOfficeChoice({ areaKey, officeId: null });
      }}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      activePersona={activePersona}
      onReset={() => {
        resetAreaFilters();
        setSelectedOfficeId(null);
      }}
      offices={candidateOffices}
      officesLoading={officesLoading}
      officeId={selectedOfficeId}
      setOfficeId={setSelectedOfficeId}
    />
  );

  const titleArea =
    currentLevel === "ward"
      ? `${toTitle(levelName)} ward`
      : currentLevel === "lga"
      ? `${toTitle(levelName)} LGA`
      : currentLevel === "state"
      ? `${toTitle(levelName)} State`
      : "All of Nigeria";

  return (
    <div className="flex w-full min-w-0 flex-col gap-3.5 text-[#0A0A0A] sm:gap-5">
      <PageHeader
        title="2027 Coverage Dashboard"
        subtitle={`Official coverage and extra agents by polling unit · ${[titleArea, filterModeLabel[filterMode]].filter(Boolean).join(" · ")}`}
        actions={
          <>
            <Tooltip>
              <TooltipTrigger render={<span tabIndex={0} className="inline-flex" />}>
                <button type="button" disabled className={WF.btnOutline}>
                  Save as area
                </button>
              </TooltipTrigger>
              <TooltipContent>Not available yet</TooltipContent>
            </Tooltip>
            <Link href={`/broadcasts/new?target=${encodeURIComponent(levelName)}`} className={WF.btnDark}>
              <Send className="h-3.5 w-3.5" />
              Broadcast to this Area
            </Link>
          </>
        }
      />

      <section aria-label="Filters" className={`${WF.card} p-3 sm:px-4 sm:py-3.5`}>
        {coverageFilters}
      </section>

      <div aria-busy={isFetchingSummary} className="relative">
        {isLoadingSummary && !kpiData ? (
          <LoadingBox>Loading the summary…</LoadingBox>
        ) : kpiData ? (
          <>
            <CenterSpinner show={isFetchingSummary} />
            <div className={isFetchingSummary ? "opacity-60 transition-opacity" : "transition-opacity"}>
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
            </div>
          </>
        ) : null}
      </div>

      <AtStakeCandidates
        stateId={selectedStateId}
        lgaId={selectedLgaId}
        wardId={selectedWardId}
        officeId={selectedOfficeId}
        areaName={titleArea}
      />

      <CoverageMap
        level={currentLevel}
        stateCode={selectedState?.code ?? selectedStateCode}
        lgaCode={selectedLga?.code ?? selectedLgaCode}
        wardCode={selectedWard?.code ?? selectedWardCode}
        areaStats={mapAreaStats}
        onPickArea={(code) => {
          if (currentLevel === "national") {
            setSelectedStateCode(code);
            setSelectedLgaCode("all");
            setSelectedWardCode("all");
          } else if (currentLevel === "state") {
            setSelectedLgaCode(code);
            setSelectedWardCode("all");
          } else if (currentLevel === "lga") {
            setSelectedWardCode(code);
          }
        }}
        stateName={selectedState?.name}
        lgaName={selectedLga?.name}
        wardName={selectedWard?.name}
        coordinatePoints={coordinatePointsQuery.data?.points ?? NO_MAP_POINTS}
        coordinatesLoading={coordinatePointsQuery.isLoading || !coordinatesEnabled}
        onPointsNeededChange={setMapNeedsPoints}
        coordinatesError={coordinatePointsQuery.error}
        coordinateViewKey={`${selectedStateCode}-${selectedLgaCode}-${selectedWardCode}`}
        onRetryCoordinates={() => {
          void coordinatePointsQuery.refetch();
        }}
      />

      <div aria-busy={isCoverageTableFetching} className="relative">
        {isCoverageTableLoading ? (
          <LoadingBox>Loading {currentLevel === "ward" ? "polling units" : currentLevel === "lga" ? "wards" : "LGAs"}…</LoadingBox>
        ) : (
          <>
            <CenterSpinner show={isCoverageTableFetching} />
            <CoverageTable
              level={currentLevel}
              states={filteredStates}
              lgas={filteredLGAs}
              wards={filteredWards}
              pollingUnits={filteredPollingUnits}
              areaName={selectedWard?.name}
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
          </>
        )}
      </div>

      <p className={WF.note}>
        Names, codes, counts and GPS: INEC. * Coverage means the polling unit has its one official agent (the
        party&rsquo;s INEC-recognised agent); extra agents, tagged by who owns them (the party or a candidate), never
        change coverage.
      </p>
    </div>
  );
}

function toTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/(^|[\s(/.-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\bFct\b/g, "FCT");
}
