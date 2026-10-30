"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MapPin, Users, ShieldCheck, AlertCircle, Info, Landmark } from "lucide-react";

interface KPISummaryProps {
  levelName: string;
  totalPUs: number;
  gpsPUs: number;
  coveredPUs: number;
  noCoveragePUs: number;
  officialAgentPct: number;
  extraAgentsCount: number;
  lgasCount?: number;
  wardsCount?: number;
  statesCount?: number;
}

export function KPISummary({
  levelName,
  totalPUs,
  gpsPUs,
  coveredPUs,
  noCoveragePUs,
  officialAgentPct,
  extraAgentsCount,
  lgasCount,
  wardsCount,
  statesCount,
}: KPISummaryProps) {
  const gpsPct = totalPUs > 0 ? Math.round((gpsPUs / totalPUs) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* Polling Units */}
      <Card className="bg-card border-border/80 shadow-sm hover:shadow transition-shadow">
        <CardContent className="p-3.5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Polling Units</span>
            <Landmark className="w-3.5 h-3.5 text-primary/70" />
          </div>
          <div className="mt-2">
            <div className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              {totalPUs.toLocaleString()}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              INEC verified in {levelName}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GPS Position */}
      <Card className="bg-card border-border/80 shadow-sm hover:shadow transition-shadow">
        <CardContent className="p-3.5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>With GPS Position</span>
            <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                {gpsPUs.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                ({gpsPct}%)
              </span>
            </div>
            <Progress value={gpsPct} className="h-1.5 mt-2 bg-blue-100 dark:bg-blue-950/50" />
          </div>
        </CardContent>
      </Card>

      {/* Wards Count */}
      <Card className="bg-card border-border/80 shadow-sm hover:shadow transition-shadow">
        <CardContent className="p-3.5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>{wardsCount !== undefined ? "Wards" : "Sub-units"}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-muted rounded text-muted-foreground">INEC</span>
          </div>
          <div className="mt-2">
            <div className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              {(wardsCount ?? (statesCount !== undefined ? statesCount : 1)).toLocaleString()}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {wardsCount !== undefined ? "Registration areas" : "Administrative units"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LGAs Count */}
      <Card className="bg-card border-border/80 shadow-sm hover:shadow transition-shadow">
        <CardContent className="p-3.5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>LGAs / Areas</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-muted rounded text-muted-foreground">Admin</span>
          </div>
          <div className="mt-2">
            <div className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              {(lgasCount ?? (statesCount !== undefined ? statesCount : 1)).toLocaleString()}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Local govt councils
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Official Party Agent Coverage */}
      <Card className="bg-card border-border/80 shadow-sm hover:shadow transition-shadow border-emerald-500/30 dark:border-emerald-500/20 col-span-2 md:col-span-1">
        <CardContent className="p-3.5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Official Coverage
            </span>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Official Party Agent coverage rule: 1 official agent per PU = 100% covered. Candidate extra agents are supplementary and do not inflate this percentage.
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xl md:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {officialAgentPct}%
              </span>
              <span className="text-[11px] text-muted-foreground">
                {coveredPUs.toLocaleString()} / {totalPUs.toLocaleString()} PUs
              </span>
            </div>
            <div className="mt-1.5 space-y-1">
              <div className="w-full bg-emerald-100 dark:bg-emerald-950/40 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-600 dark:bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, officialAgentPct)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  {noCoveragePUs.toLocaleString()} gaps
                </span>
                <span>Target: 100%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Extra Agents (Candidate-sponsored) */}
      <Card className="bg-card border-border/80 shadow-sm hover:shadow transition-shadow col-span-2 md:col-span-1">
        <CardContent className="p-3.5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Extra Agents
            </span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
              Tagged
            </Badge>
          </div>
          <div className="mt-2">
            <div className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              {extraAgentsCount.toLocaleString()}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Candidate-sponsored protectors & mobilisers
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
