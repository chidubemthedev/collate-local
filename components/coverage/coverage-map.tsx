"use client";

import React, { useState } from "react";
import { PollingUnitData } from "@/lib/types";
import type { StateCoverage, LgaCoverage, WardCoverage } from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MapPin, Navigation, Maximize2, RotateCcw, ShieldCheck, AlertCircle, Users, ExternalLink } from "lucide-react";

interface CoverageMapProps {
  stateCode: string;
  lgaCode: string;
  wardCode: string;
  stateName?: string;
  lgaName?: string;
  wardName?: string;
  states: StateCoverage[];
  lgas: LgaCoverage[];
  wards: WardCoverage[];
  pollingUnits: PollingUnitData[];
  onSelectState: (code: string) => void;
  onSelectLga: (code: string) => void;
  onSelectWard: (code: string) => void;
  onSelectPU?: (pu: PollingUnitData) => void;
}

export function CoverageMap({
  stateCode,
  lgaCode,
  wardCode,
  stateName,
  lgaName,
  wardName,
  states,
  lgas,
  wards,
  pollingUnits,
  onSelectState,
  onSelectLga,
  onSelectWard,
  onSelectPU,
}: CoverageMapProps) {
  const [activeTab, setActiveTab] = useState<"density" | "geo">("density");
  const [hoveredItem, setHoveredItem] = useState<{ title: string; subtitle: string; coverage: number; total: number; covered: number; gaps: number } | null>(null);

  // Determine current map mode: "national" | "state" | "lga" | "ward"
  const isWardLevel = wardCode !== "all";
  const isLgaLevel = lgaCode !== "all" && !isWardLevel;
  const isStateLevel = stateCode !== "all" && !isLgaLevel && !isWardLevel;
  const isNational = stateCode === "all";

  // Data subsets come from the live API lists passed in by the page
  const stateLGAs = lgas;
  const lgaWards = wards;
  const wardPUs = pollingUnits;
  const wardCoveredCount = wardPUs.filter((p) => p.hasOfficialAgent).length;
  const wardCoveragePct = wardPUs.length > 0 ? Math.round((wardCoveredCount / wardPUs.length) * 100) : 0;

  const getCoverageColor = (pct: number) => {
    if (pct >= 50) return "bg-emerald-500 text-white";
    if (pct >= 30) return "bg-amber-500 text-white";
    return "bg-rose-500 text-white";
  };

  const getCoverageBorderColor = (pct: number) => {
    if (pct >= 50) return "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20";
    if (pct >= 30) return "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20";
    return "border-rose-500/40 bg-rose-50 dark:bg-rose-950/20";
  };

  return (
    <Card className="border-border/80 bg-card overflow-hidden shadow-sm">
      <CardHeader className="py-2.5 px-4 bg-muted/30 border-b border-border/60 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-primary/10 text-primary">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-2">
              <span>Geographic Coverage Visualizer</span>
              <Badge variant="outline" className="text-[10px] font-mono font-normal">
                {isWardLevel
                  ? "Ward PU Scatter"
                  : isLgaLevel
                  ? "LGA Wards Map"
                  : isStateLevel
                  ? "State LGAs Map"
                  : `National ${states.length} States`}
              </Badge>
            </CardTitle>
          </div>
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>Covered (≥1 Official Agent)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span>Gap (0 Official Agents)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            <span>GPS Pin</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {/* WARD LEVEL - POLING UNITS DOT SCATTER MAP */}
        {isWardLevel && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 border-b border-border/40">
              <span className="font-medium text-foreground">
                {wardName ?? wardCode} ({wardCode}) — {wardPUs.length} Polling Units Scatter Plot
              </span>
              <span>Click a node to inspect agent roster</span>
            </div>

            {wardPUs.length === 0 && (
              <div className="py-10 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg">
                No polling units to show for this ward.
              </div>
            )}

            {wardPUs.length > 0 && (
            <div className="relative bg-muted/20 border border-border/60 rounded-lg p-4 sm:p-6 min-h-[260px] flex flex-col justify-between">
              {/* Grid background simulation */}
              <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px] rounded-lg opacity-60 pointer-events-none" />

              <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2.5">
                {wardPUs.map((pu, idx) => {
                  const isCovered = pu.hasOfficialAgent;
                  return (
                    <Tooltip key={pu.code}>
                      <TooltipTrigger
                        onClick={() => onSelectPU && onSelectPU(pu)}
                        className={`relative p-2.5 rounded-lg border text-left transition-all hover:scale-105 hover:shadow-md cursor-pointer ${
                          isCovered
                            ? "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500/50 hover:border-emerald-600"
                            : "bg-amber-50/90 dark:bg-amber-950/40 border-amber-500/50 hover:border-amber-600"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-foreground">
                            #{idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isCovered ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                            }`}
                          />
                        </div>
                        <div className="font-semibold text-[11px] text-foreground truncate mt-1">
                          {pu.name}
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[9px] text-muted-foreground font-mono">
                          <span>{pu.hasGPS ? "GPS OK" : "No GPS"}</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                            +{pu.extraAgents.length}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs space-y-1.5 p-3">
                        <div className="font-bold text-foreground">{pu.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{pu.code}</div>
                        <div className="text-muted-foreground text-[11px]">{pu.location}</div>
                        <div className="pt-1.5 border-t border-border flex items-center justify-between text-[11px]">
                          <span className="font-medium">
                            {isCovered ? (
                              <span className="text-emerald-600 font-bold flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> Official agent assigned
                              </span>
                            ) : (
                              <span className="text-amber-600 font-bold flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> GAP – No official agent
                              </span>
                            )}
                          </span>
                        </div>
                        {pu.officialAgentName && (
                          <div className="text-[11px] text-muted-foreground">
                            Agent: <span className="text-foreground font-medium">{pu.officialAgentName}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-indigo-600 dark:text-indigo-300">
                          {pu.extraAgents.length} Extra candidate agent(s) registered
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>

              {/* Bottom stats row */}
              <div className="relative z-10 mt-4 pt-3 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    Ward Coverage:{" "}
                    <strong className="text-foreground">
                      {wardCoveragePct}% ({wardCoveredCount} of {wardPUs.length} PUs)
                    </strong>
                  </span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {wardPUs.length - wardCoveredCount} Gaps remaining
                  </span>
                </div>
              </div>
            </div>
            )}
          </div>
        )}

        {/* LGA LEVEL - WARDS MAP */}
        {isLgaLevel && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 border-b border-border/40">
              <span className="font-medium text-foreground">
                {lgaName ?? lgaCode} ({lgaCode}) — {lgaWards.length} Wards Coverage Heatmap
              </span>
              <span>Click a ward to drill down to Polling Units</span>
            </div>

            {lgaWards.length === 0 && (
              <div className="py-10 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg">
                No wards to show for this LGA.
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
              {lgaWards.map((w) => {
                const isSelected = wardCode === w.code;
                return (
                  <button
                    key={w.code}
                    onClick={() => onSelectWard(w.code)}
                    className={`p-3 rounded-lg border text-left transition-all hover:scale-[1.02] hover:shadow cursor-pointer ${
                      isSelected
                        ? "ring-2 ring-primary border-primary bg-primary/10"
                        : getCoverageBorderColor(w.officialAgentPct)
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                        {w.code}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 h-4 font-bold ${getCoverageColor(
                          w.officialAgentPct
                        )}`}
                      >
                        {w.officialAgentPct}%
                      </Badge>
                    </div>
                    <div className="font-semibold text-xs text-foreground truncate mt-1">
                      {w.name}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                      <span>{w.coveredPUs} / {w.totalPUs} PUs</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-medium">+{w.extraAgentsCount}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STATE LEVEL - LGAS MAP */}
        {isStateLevel && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 border-b border-border/40">
              <span className="font-medium text-foreground">
                {stateName ?? stateCode} ({stateCode}) — Local Government Areas
              </span>
              <span>Click an LGA to drill down</span>
            </div>

            {stateLGAs.length === 0 && (
              <div className="py-10 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg">
                No LGAs to show for this state.
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
              {stateLGAs.map((lga) => {
                const isSelected = lgaCode === lga.code;
                return (
                  <button
                    key={lga.code}
                    onClick={() => onSelectLga(lga.code)}
                    className={`p-3 rounded-lg border text-left transition-all hover:scale-[1.02] hover:shadow cursor-pointer ${
                      isSelected
                        ? "ring-2 ring-primary border-primary bg-primary/10"
                        : getCoverageBorderColor(lga.officialAgentPct)
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                        {lga.code}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 h-4 font-bold ${getCoverageColor(
                          lga.officialAgentPct
                        )}`}
                      >
                        {lga.officialAgentPct}%
                      </Badge>
                    </div>
                    <div className="font-semibold text-xs text-foreground truncate mt-1">
                      {lga.name}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                      <span>{lga.coveredPUs} / {lga.totalPUs} PUs</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-medium">+{lga.extraAgentsCount}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* NATIONAL LEVEL - 37 STATES MAP / HEATMAP GRID */}
        {isNational && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 border-b border-border/40">
              <span className="font-medium text-foreground">
                National Overview — {states.length} states
              </span>
              <span>Click any state to drill down</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2">
              {states.map((st) => (
                <button
                  key={st.code}
                  onClick={() => onSelectState(st.code)}
                  className={`p-2.5 rounded-lg border text-left transition-all hover:scale-105 hover:shadow-sm cursor-pointer ${getCoverageBorderColor(
                    st.officialAgentPct
                  )}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-muted-foreground font-bold">
                      {st.code}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`text-[9px] px-1 py-0 h-3.5 font-bold ${getCoverageColor(
                        st.officialAgentPct
                      )}`}
                    >
                      {st.officialAgentPct}%
                    </Badge>
                  </div>
                  <div className="font-bold text-xs text-foreground truncate mt-1">
                    {st.name}
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[9px] text-muted-foreground">
                    <span>{st.totalPUs.toLocaleString()} PUs</span>
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      {st.noCoveragePUs.toLocaleString()} gaps
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
