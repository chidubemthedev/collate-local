"use client";

import React from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";

interface AgentsKPISummaryProps {
  totalPUs: number;
  officialCount: number;
  extraCount: number;
  gapsCount: number;
  /** The area the numbers cover, e.g. "Nigeria" or a state name. */
  areaName: string;
}

const CARD = "flex h-full flex-col rounded-xl border border-border/60 bg-card p-4";
const LABEL = "text-[11px] font-medium text-foreground/80";
const VALUE = "mt-3 flex items-baseline gap-2 text-xl md:text-2xl font-bold tracking-tight";
const SUFFIX = "text-xs font-normal text-muted-foreground";
const NOTE = "mt-3 flex flex-wrap items-center gap-1.5 text-[10px] leading-snug text-muted-foreground";

export function AgentsKPISummary({
  totalPUs,
  officialCount,
  extraCount,
  gapsCount,
  areaName,
}: AgentsKPISummaryProps) {
  const officialPct = totalPUs > 0 ? Math.round((officialCount / totalPUs) * 100) : 0;
  const gapsPct = totalPUs > 0 ? Math.round((gapsCount / totalPUs) * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className={CARD}>
        <div className={LABEL}>Polling Units</div>
        <div className={`${VALUE} text-foreground`}>
          <AnimatedNumber value={totalPUs} />
        </div>
        <div className={NOTE}>
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold leading-none text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            INEC
          </span>
          <span>in {areaName}</span>
        </div>
      </div>

      <div className={CARD}>
        <div className={LABEL}>Official Party Agents</div>
        <div className={VALUE}>
          <span className="text-emerald-600 dark:text-emerald-400">
            <AnimatedNumber value={officialCount} />
          </span>
          <span className={SUFFIX}>
            <AnimatedNumber value={officialPct} />% coverage
          </span>
        </div>
        <div className={NOTE}>one per unit = covered</div>
      </div>

      <div className={CARD}>
        <div className={LABEL}>Extra Agents</div>
        <div className={`${VALUE} text-violet-600 dark:text-violet-400`}>
          <AnimatedNumber value={extraCount} />
        </div>
        <div className={NOTE}>support groups and candidates · never coverage</div>
      </div>

      <div className={CARD}>
        <div className={LABEL}>Coverage Gaps</div>
        <div className={VALUE}>
          <span className="text-amber-800 dark:text-amber-500">
            <AnimatedNumber value={gapsCount} />
          </span>
          <span className={SUFFIX}>
            <AnimatedNumber value={gapsPct} />%
          </span>
        </div>
        <div className={NOTE}>units with no official agent</div>
      </div>
    </div>
  );
}
