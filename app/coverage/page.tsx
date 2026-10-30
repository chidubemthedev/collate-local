"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/lib/context/app-context";
import {
  NIGERIA_SUMMARY,
  STATES_DATA,
  LGAS_DATA,
  WARDS_DATA,
  POLLING_UNITS_DATA,
} from "@/lib/data/inec-data";
import { KPISummary } from "@/components/coverage/kpi-summary";
import { AtStakeCandidates } from "@/components/coverage/at-stake-candidates";
import { CoverageMap } from "@/components/coverage/coverage-map";
import { CoverageFilters } from "@/components/coverage/coverage-filters";
import { CoverageTable } from "@/components/coverage/coverage-table";
import { PoliticalUnitsView } from "@/components/coverage/political-units-view";
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

  // Compute KPI metrics dynamically based on current scope
  const kpiData = useMemo(() => {
    if (currentLevel === "ward") {
      const pus = POLLING_UNITS_DATA.filter((p) => p.wardCode === selectedWardCode);
      const covered = pus.filter((p) => p.hasOfficialAgent).length;
      const total = pus.length;
      const gaps = total - covered;
      const extraCount = pus.reduce((acc, p) => acc + p.extraAgents.length, 0);
      const gpsCount = pus.filter((p) => p.hasGPS).length;
      const pct = total > 0 ? Math.round((covered / total) * 100) : 0;
      const wardObj = WARDS_DATA.find((w) => w.code === selectedWardCode);

      return {
        levelName: wardObj?.name || selectedWardCode,
        totalPUs: total,
        gpsPUs: gpsCount,
        coveredPUs: covered,
        noCoveragePUs: gaps,
        officialAgentPct: pct,
        extraAgentsCount: extraCount,
        wardsCount: 1,
        lgasCount: 1,
      };
    }

    if (currentLevel === "lga") {
      const lgaObj = LGAS_DATA.find((l) => l.code === selectedLgaCode);
      if (lgaObj) {
        return {
          levelName: lgaObj.name,
          totalPUs: lgaObj.totalPUs,
          gpsPUs: lgaObj.gpsPUs,
          coveredPUs: lgaObj.coveredPUs,
          noCoveragePUs: lgaObj.noCoveragePUs,
          officialAgentPct: lgaObj.officialAgentPct,
          extraAgentsCount: lgaObj.extraAgentsCount,
          wardsCount: lgaObj.wardsCount,
          lgasCount: 1,
        };
      }
    }

    if (currentLevel === "state") {
      const stateObj = STATES_DATA.find((s) => s.code === selectedStateCode);
      if (stateObj) {
        return {
          levelName: stateObj.name,
          totalPUs: stateObj.totalPUs,
          gpsPUs: stateObj.gpsPUs,
          coveredPUs: stateObj.coveredPUs,
          noCoveragePUs: stateObj.noCoveragePUs,
          officialAgentPct: stateObj.officialAgentPct,
          extraAgentsCount: stateObj.extraAgentsCount,
          wardsCount: stateObj.wardsCount,
          lgasCount: stateObj.lgasCount,
        };
      }
    }

    // Default National
    return {
      levelName: "Nigeria",
      totalPUs: NIGERIA_SUMMARY.totalPUs,
      gpsPUs: NIGERIA_SUMMARY.gpsPUs,
      coveredPUs: NIGERIA_SUMMARY.coveredPUs,
      noCoveragePUs: NIGERIA_SUMMARY.noCoveragePUs,
      officialAgentPct: NIGERIA_SUMMARY.officialAgentPct,
      extraAgentsCount: NIGERIA_SUMMARY.extraAgentsCount,
      wardsCount: NIGERIA_SUMMARY.wardsCount,
      lgasCount: NIGERIA_SUMMARY.lgasCount,
      statesCount: NIGERIA_SUMMARY.statesCount,
    };
  }, [currentLevel, selectedStateCode, selectedLgaCode, selectedWardCode]);

  // Filter and sort States data
  const filteredStates = useMemo(() => {
    let result = [...STATES_DATA];

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
  }, [filterMode, searchQuery, sortBy]);

  // Filter and sort LGAs data
  const filteredLGAs = useMemo(() => {
    let result = LGAS_DATA.filter((l) => l.stateCode === selectedStateCode);

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
  }, [selectedStateCode, filterMode, searchQuery, sortBy]);

  // Filter and sort Wards data
  const filteredWards = useMemo(() => {
    let result = WARDS_DATA.filter((w) => w.lgaCode === selectedLgaCode);

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
  }, [selectedLgaCode, filterMode, searchQuery, sortBy]);

  // Filter and sort Polling Units data
  const filteredPollingUnits = useMemo(() => {
    let result = POLLING_UNITS_DATA.filter((p) => p.wardCode === selectedWardCode);

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
  }, [selectedWardCode, filterMode, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              2027 Coverage Dashboard
            </h1>
            <Badge variant="outline" className="text-xs px-2 py-0.5 gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live INEC Engine
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Monitor real-time official party agent deployment across Nigeria&apos;s 176,846 polling units.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/broadcasts/new?target=${encodeURIComponent(kpiData.levelName)}`}
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
        totalPUsCount={kpiData.totalPUs}
        gapsCount={kpiData.noCoveragePUs}
        onReset={resetAreaFilters}
      />

      {/* Top Metric Cards */}
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
