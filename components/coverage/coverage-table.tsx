"use client";

import React, { useState } from "react";
import { formatCoverage, NOT_AVAILABLE_YET } from "@/lib/coverage/format";
import { StateData, LGAData, WardData, PollingUnitData } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PUDetailDrawer } from "./pu-detail-drawer";
import {
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  AlertCircle,
  MapPin,
  ExternalLink,
  Download,
  Send,
  Eye,
  Info,
  Building,
} from "lucide-react";
import Link from "next/link";

// INEC names come in upper case (e.g. "AKWA IBOM"); show them as "Akwa Ibom", keeping FCT as is.
function toTitleCase(name: string) {
  return name
    .toLowerCase()
    .replace(/(^|[\s\-'(])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\bFct\b/g, "FCT");
}

interface CoverageTableProps {
  level: "national" | "state" | "lga" | "ward";
  states: StateData[];
  lgas: LGAData[];
  wards: WardData[];
  pollingUnits: PollingUnitData[];
  onOpenState: (code: string) => void;
  onOpenLga: (code: string) => void;
  onOpenWard: (code: string) => void;
}

export function CoverageTable({
  level,
  states,
  lgas,
  wards,
  pollingUnits,
  onOpenState,
  onOpenLga,
  onOpenWard,
}: CoverageTableProps) {
  const [selectedPU, setSelectedPU] = useState<PollingUnitData | null>(null);
  const [isPUModalOpen, setIsPUModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAllStates, setShowAllStates] = useState(false);
  const PAGE_SIZE = 10;
  const STATES_INITIAL_COUNT = 15;

  // Auto-reset page when level or data source changes
  React.useEffect(() => {
    setCurrentPage(1);
    setShowAllStates(false);
  }, [level, states.length, lgas.length, wards.length, pollingUnits.length]);

  const totalItems =
    level === "national"
      ? states.length
      : level === "state"
      ? lgas.length
      : level === "lga"
      ? wards.length
      : pollingUnits.length;

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);

  const paginatedStates = states.slice(startIndex, endIndex);
  const paginatedLgas = lgas.slice(startIndex, endIndex);
  const paginatedWards = wards.slice(startIndex, endIndex);
  const paginatedPollingUnits = pollingUnits.slice(startIndex, endIndex);

  const handleOpenPU = (pu: PollingUnitData) => {
    setSelectedPU(pu);
    setIsPUModalOpen(true);
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    if (level === "national") {
      csvContent += "Code,State,Total PUs,With GPS,Official Covered,Coverage %,Extra Agents\n";
      states.forEach((s) => {
        csvContent += `"${s.code}","${s.name}",${s.totalPUs},${s.gpsPUs},${s.coveredPUs},"${s.officialAgentPct}%",${s.extraAgentsCount}\n`;
      });
    } else if (level === "state") {
      csvContent += "Code,LGA,Total PUs,With GPS,Official Covered,Coverage %,Extra Agents\n";
      lgas.forEach((l) => {
        csvContent += `"${l.code}","${l.name}",${l.totalPUs},${l.gpsPUs},${l.coveredPUs},"${l.officialAgentPct}%",${l.extraAgentsCount}\n`;
      });
    } else if (level === "lga") {
      csvContent += "Code,Ward,State Constituency,Total PUs,With GPS,Official Covered,Coverage %,Extra Agents\n";
      wards.forEach((w) => {
        csvContent += `"${w.code}","${w.name}","${w.stateConstituency || ""}",${w.totalPUs},${w.gpsPUs},${w.coveredPUs},"${w.officialAgentPct}%",${w.extraAgentsCount}\n`;
      });
    } else {
      csvContent += "INEC Code,Polling Unit Name,Location,Latitude,Longitude,Official Agent,Extra Agents Count\n";
      pollingUnits.forEach((p) => {
        csvContent += `"${p.code}","${p.name}","${p.location}",${p.latitude},${p.longitude},"${p.hasOfficialAgent ? p.officialAgentName || 'Assigned' : 'GAP'}",${p.extraAgents.length}\n`;
      });
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ndc-coverage-${level}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (level === "national") {
    const visibleStates = showAllStates ? states : states.slice(0, STATES_INITIAL_COUNT);
    const hiddenCount = states.length - visibleStates.length;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-foreground">Breakdown by State</h3>
            <span className="rounded border border-border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              National
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 px-3 text-[11px]"
          >
            Export CSV
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="text-[11px]">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-20 font-semibold text-foreground">Code</TableHead>
                <TableHead className="font-semibold text-foreground">State</TableHead>
                <TableHead className="font-semibold text-foreground">Total PUs</TableHead>
                <TableHead className="font-semibold text-foreground hidden md:table-cell">With GPS</TableHead>
                <TableHead
                  className="font-semibold text-foreground min-w-[180px]"
                  title="A polling unit is covered when it has 1 official agent"
                >
                  Official coverage *
                </TableHead>
                <TableHead
                  className="font-semibold text-foreground hidden sm:table-cell"
                  title="Extra agents assigned on top of the official agent"
                >
                  Extra agents *
                </TableHead>
                <TableHead className="text-right font-semibold text-foreground w-24">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-[11px]">
              {states.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No states match your search query or filter.
                  </TableCell>
                </TableRow>
              ) : (
                visibleStates.map((st) => {
                  const gpsPct = st.totalPUs > 0 ? Math.round((st.gpsPUs / st.totalPUs) * 100) : 0;
                  return (
                    <TableRow
                      key={st.code}
                      className="h-[37px] hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => onOpenState(st.code)}
                    >
                      <TableCell className="text-muted-foreground">{st.code}</TableCell>
                      <TableCell className="font-semibold text-foreground">{toTitleCase(st.name)}</TableCell>
                      <TableCell className="text-foreground tabular-nums">
                        {st.totalPUs.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums hidden md:table-cell">
                        {st.gpsPUs.toLocaleString()} ({gpsPct}%)
                      </TableCell>
                      <TableCell>
                        <div className="w-[120px] space-y-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                              {st.officialAgentPct}%
                            </span>
                            <span className="text-[9px] text-muted-foreground tabular-nums whitespace-nowrap">
                              {st.coveredPUs.toLocaleString()} / {st.totalPUs.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-1 w-full overflow-hidden rounded-full bg-emerald-50 dark:bg-emerald-950/40">
                            <div
                              className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500"
                              style={{ width: `${Math.min(100, Math.max(0, st.officialAgentPct))}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-purple-600 dark:text-purple-400 tabular-nums hidden sm:table-cell">
                        {st.extraAgentsCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs font-semibold"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenState(st.code);
                          }}
                        >
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {states.length > 0 && (
          <div className="flex items-center justify-between gap-2 border-t border-border/60 px-1 pt-3 text-[11px]">
            <span className="text-muted-foreground">
              Showing {visibleStates.length} of {states.length} states
            </span>
            {hiddenCount > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-[11px]"
                onClick={() => setShowAllStates(true)}
              >
                Show {hiddenCount} more
              </Button>
            ) : states.length > STATES_INITIAL_COUNT ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-[11px]"
                onClick={() => setShowAllStates(false)}
              >
                Show less
              </Button>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Table Action Bar */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-foreground">
            {level === "national" && `States Breakdown (${states.length})`}
            {level === "state" && `Local Government Areas (${lgas.length})`}
            {level === "lga" && `Wards (${wards.length})`}
            {level === "ward" && `Polling Units Details (${pollingUnits.length})`}
          </h3>
          <Badge variant="outline" className="text-[10px] font-mono">
            {level.toUpperCase()}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="text-xs h-7.5 gap-1.5 px-2.5"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      {/* TABLE CONTAINER */}
      <div className="border border-border/60 rounded-xl overflow-hidden bg-card shadow-none">
        {/* NATIONAL LEVEL TABLE (STATES) */}
        {level === "national" && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/40 text-[11px]">
                <TableRow>
                  <TableHead className="w-16 font-semibold">Code</TableHead>
                  <TableHead className="font-semibold">State</TableHead>
                  <TableHead className="text-right font-semibold">Total PUs</TableHead>
                  <TableHead className="text-right font-semibold hidden md:table-cell">With GPS</TableHead>
                  <TableHead className="font-semibold min-w-[180px]">Official Coverage</TableHead>
                  <TableHead className="text-right font-semibold hidden sm:table-cell">Extra Agents</TableHead>
                  <TableHead className="text-right font-semibold w-24">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-[11px]">
                {states.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No states match your search query or filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedStates.map((st) => (
                    <TableRow
                      key={st.code}
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => onOpenState(st.code)}
                    >
                      <TableCell className="font-mono text-muted-foreground font-semibold">
                        {st.code}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-muted-foreground/70" />
                          <span>{st.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {st.totalPUs.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground hidden md:table-cell">
                        {st.gpsPUs.toLocaleString()}{" "}
                        <span className="text-[10px]">({Math.round((st.gpsPUs / st.totalPUs) * 100)}%)</span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              {formatCoverage(st.coveredPUs, st.totalPUs, st.officialAgentPct)}
                            </span>
                          </div>
                          <div className="w-full bg-emerald-100 dark:bg-emerald-950/40 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-600 dark:bg-emerald-500 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, st.officialAgentPct)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-indigo-600 dark:text-indigo-400 font-semibold hidden sm:table-cell">
                        +{st.extraAgentsCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs font-semibold gap-1 text-primary group-hover:translate-x-0.5 transition-transform"
                        >
                          Open
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* STATE LEVEL TABLE (LGAS) */}
        {level === "state" && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/40 text-[11px]">
                <TableRow>
                  <TableHead className="w-20 font-semibold">Code</TableHead>
                  <TableHead className="font-semibold">Local Govt Area</TableHead>
                  <TableHead className="font-semibold hidden lg:table-cell">Constituency</TableHead>
                  <TableHead className="text-right font-semibold">Total PUs</TableHead>
                  <TableHead className="text-right font-semibold hidden md:table-cell">With GPS</TableHead>
                  <TableHead className="font-semibold min-w-[180px]">Official Coverage</TableHead>
                  <TableHead className="text-right font-semibold hidden sm:table-cell">Extra Agents</TableHead>
                  <TableHead className="text-right font-semibold w-24">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-[11px]">
                {lgas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No LGAs match your search query or filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLgas.map((lga) => (
                    <TableRow
                      key={lga.code}
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => onOpenLga(lga.code)}
                    >
                      <TableCell className="font-mono text-muted-foreground font-semibold">
                        {lga.code}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {toTitleCase(lga.name)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-[11px] hidden lg:table-cell">
                        {lga.federalConstituency || "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {lga.totalPUs.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground hidden md:table-cell">
                        {lga.gpsPUs.toLocaleString()} ({Math.round((lga.gpsPUs / lga.totalPUs) * 100)}%)
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              {formatCoverage(lga.coveredPUs, lga.totalPUs, lga.officialAgentPct)}
                            </span>
                          </div>
                          <div className="w-full bg-emerald-100 dark:bg-emerald-950/40 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-600 dark:bg-emerald-500 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, lga.officialAgentPct)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-indigo-600 dark:text-indigo-400 font-semibold hidden sm:table-cell">
                        +{lga.extraAgentsCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs font-semibold gap-1 text-primary group-hover:translate-x-0.5 transition-transform"
                        >
                          Open
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* LGA LEVEL TABLE (WARDS) */}
        {level === "lga" && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/40 text-[11px]">
                <TableRow>
                  <TableHead className="w-24 font-semibold">Code</TableHead>
                  <TableHead className="font-semibold">Ward Name</TableHead>
                  <TableHead className="font-semibold hidden md:table-cell">State Const.</TableHead>
                  <TableHead className="text-right font-semibold">Total PUs</TableHead>
                  <TableHead className="text-right font-semibold hidden md:table-cell">With GPS</TableHead>
                  <TableHead className="font-semibold min-w-[180px]">Official Coverage</TableHead>
                  <TableHead className="text-right font-semibold hidden sm:table-cell">Extra Agents</TableHead>
                  <TableHead className="text-right font-semibold w-24">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-[11px]">
                {wards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No wards match your search query or filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedWards.map((w) => (
                    <TableRow
                      key={w.code}
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => onOpenWard(w.code)}
                    >
                      <TableCell className="font-mono text-muted-foreground font-semibold">
                        {w.code}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {w.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-[11px] hidden md:table-cell">
                        {w.stateConstituency || "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {w.totalPUs.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground hidden md:table-cell">
                        {w.gpsPUs.toLocaleString()} ({Math.round((w.gpsPUs / w.totalPUs) * 100)}%)
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              {formatCoverage(w.coveredPUs, w.totalPUs, w.officialAgentPct)}
                            </span>
                          </div>
                          <div className="w-full bg-emerald-100 dark:bg-emerald-950/40 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-600 dark:bg-emerald-500 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, w.officialAgentPct)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-indigo-600 dark:text-indigo-400 font-semibold hidden sm:table-cell">
                        +{w.extraAgentsCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs font-semibold gap-1 text-primary group-hover:translate-x-0.5 transition-transform"
                        >
                          Open
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* WARD LEVEL - POLLING UNIT DETAIL TABLE (Inland Town I 19 PUs) */}
        {level === "ward" && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/40 text-[11px]">
                <TableRow>
                  <TableHead className="w-32 font-semibold">INEC Code</TableHead>
                  <TableHead className="font-semibold min-w-[200px]">Polling Unit & Location</TableHead>
                  <TableHead className="font-semibold hidden md:table-cell">GPS Position</TableHead>
                  <TableHead className="font-semibold min-w-[180px]">Official Agent Status</TableHead>
                  <TableHead className="font-semibold hidden lg:table-cell min-w-[160px]">Extra Agents</TableHead>
                  <TableHead className="text-right font-semibold w-24">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-[11px]">
                {pollingUnits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No polling units match your filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPollingUnits.map((pu) => {
                    const isCovered = pu.hasOfficialAgent;
                    const hasValidCoords = typeof pu.latitude === "number" && typeof pu.longitude === "number" && (pu.latitude !== 0 || pu.longitude !== 0);
                    const mapUrl = hasValidCoords
                      ? `https://www.google.com/maps/search/?api=1&query=${pu.latitude},${pu.longitude}`
                      : "#";

                    return (
                      <TableRow
                        key={pu.code}
                        className={`hover:bg-muted/30 transition-colors ${
                          !isCovered ? "bg-amber-500/5 dark:bg-amber-950/10" : ""
                        }`}
                      >
                        <TableCell className="font-mono font-bold text-foreground">
                          <span className="p-1 rounded bg-muted/60">{pu.code}</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-semibold text-foreground text-sm">{pu.name}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-muted-foreground/80 shrink-0" />
                              <span>{pu.location || pu.name}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="space-y-0.5 text-[11px] font-mono">
                            <div className="text-foreground">
                              {hasValidCoords
                                ? `${pu.latitude.toFixed(4)}°, ${pu.longitude.toFixed(4)}°`
                                : "No GPS data"}
                            </div>
                            {hasValidCoords && (
                              <a
                                href={mapUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline flex items-center gap-0.5 text-[10px]"
                              >
                                <span>Open in map</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isCovered ? (
                            <div className="space-y-1">
                              <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-[10px] px-1.5 py-0 h-4.5 gap-1">
                                <ShieldCheck className="w-3 h-3" />
                                Official Agent Assigned
                              </Badge>
                              <div className="text-[11px] font-medium text-foreground">
                                {pu.officialAgentName}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {pu.officialAgentPhone || NOT_AVAILABLE_YET}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Badge variant="destructive" className="bg-amber-600 text-white hover:bg-amber-700 text-[10px] px-1.5 py-0 h-4.5 gap-1">
                                <AlertCircle className="w-3 h-3" />
                                GAP – No Official Agent
                              </Badge>
                              <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                                Needs assignment
                              </p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {pu.extraAgents.length === 0 ? (
                            <span className="text-muted-foreground text-[11px]">None</span>
                          ) : (
                            <div className="space-y-1">
                              <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                                {pu.extraAgents.length} Extra Agent{pu.extraAgents.length > 1 ? "s" : ""}
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {pu.extraAgents.map((ag) => (
                                  <Badge
                                    key={ag.id}
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 h-4 bg-background font-normal truncate max-w-[140px]"
                                    title={`${ag.owner} (${ag.name})`}
                                  >
                                    {ag.owner.split("·")[0].trim()}: {ag.role || "Protector"}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2 gap-1"
                            onClick={() => handleOpenPU(pu)}
                          >
                            <Eye className="w-3 h-3" />
                            <span className="hidden sm:inline">Inspect</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 px-3.5 py-2.5 border-t border-border/60 bg-muted/20 text-[11px]">
            <div className="text-muted-foreground text-center sm:text-left">
              Showing <span className="font-semibold text-foreground">{startIndex + 1}</span>–
              <span className="font-semibold text-foreground">{endIndex}</span> of{" "}
              <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span>{" "}
              {level === "national"
                ? "states"
                : level === "state"
                ? "LGAs"
                : level === "lga"
                ? "wards"
                : "polling units"}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="h-7 text-xs px-2.5 gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </Button>

                <span className="text-xs px-2 text-muted-foreground font-medium">
                  Page <span className="text-foreground font-semibold">{safeCurrentPage}</span> of{" "}
                  <span className="text-foreground font-semibold">{totalPages}</span>
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="h-7 text-xs px-2.5 gap-1"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PU Detail Drawer */}
      <PUDetailDrawer
        pu={selectedPU}
        open={isPUModalOpen}
        onOpenChange={setIsPUModalOpen}
      />
    </div>
  );
}
