"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ShieldCheck, Users, AlertCircle, Phone, Info } from "lucide-react";

interface AgentsKPISummaryProps {
  officialCount: number;
  extraCount: number;
  gapsCount: number;
  totalPUs: number;
}

export function AgentsKPISummary({
  officialCount,
  extraCount,
  gapsCount,
  totalPUs,
}: AgentsKPISummaryProps) {
  const officialPct = totalPUs > 0 ? Math.round((officialCount / totalPUs) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {/* Official Party Agents */}
      <div className="bg-card border border-border/70 rounded-xl p-3.5 space-y-2 border-emerald-500/30 dark:border-emerald-500/20">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Official Party Agents
          </span>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-3.5 h-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              Official rule: Exactly 1 Official Party Agent per PU counts towards the official coverage target.
            </TooltipContent>
          </Tooltip>
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {officialCount.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {officialPct}% Coverage
            </span>
          </div>
          <Progress value={officialPct} className="h-1.5 mt-2 bg-emerald-100 dark:bg-emerald-950/40" />
          <div className="text-[11px] text-muted-foreground mt-1">
            1 per PU = 100% official coverage
          </div>
        </div>
      </div>

      {/* Candidate-Sponsored Extra Agents */}
      <div className="bg-card border border-border/70 rounded-xl p-3.5 space-y-2 border-indigo-500/30 dark:border-indigo-500/20">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span className="flex items-center gap-1.5 font-semibold text-indigo-700 dark:text-indigo-400">
            <Users className="w-4 h-4 text-indigo-600" />
            Candidate Extra Agents
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
            Tagged
          </Badge>
        </div>
        <div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {extraCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Candidate-sponsored protectors & mobilisers
          </div>
        </div>
      </div>

      {/* Gaps / Uncovered PUs */}
      <div className="col-span-2 md:col-span-1 bg-card border border-border/70 rounded-xl p-3.5 space-y-2 border-amber-500/30 dark:border-amber-500/20">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            Coverage Gaps
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300">
            Needs Agent
          </Badge>
        </div>
        <div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {gapsCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-amber-700 dark:text-amber-400/90 mt-1 font-medium">
            Polling units with 0 official agents
          </div>
        </div>
      </div>
    </div>
  );
}
