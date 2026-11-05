"use client";

import React from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";

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

function SourceTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold leading-none bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
      {children}
    </span>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
      {children}
    </div>
  );
}

const CARD = "bg-card border border-border/60 rounded-xl p-4 flex flex-col h-full";
const LABEL = "text-xs text-muted-foreground font-medium";
const VALUE = "mt-3 text-2xl md:text-3xl font-bold tracking-tight";

export function KPISummary({
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
  const noGpsPUs = Math.max(0, totalPUs - gpsPUs);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <div className={CARD}>
        <div className={LABEL}>Polling Units</div>
        <div className={`${VALUE} text-foreground`}>
          <AnimatedNumber value={totalPUs} />
        </div>
        <Note>
          <SourceTag>INEC</SourceTag>
          <span>INEC register total</span>
        </Note>
      </div>

      <div className={CARD}>
        <div className={LABEL}>With GPS Position</div>
        <div className={`${VALUE} text-foreground flex items-baseline gap-2`}>
          <AnimatedNumber value={gpsPUs} />
          <span className="text-sm font-medium text-muted-foreground">
            <AnimatedNumber value={gpsPct} />%
          </span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-1 rounded-full bg-foreground" style={{ width: `${Math.min(100, gpsPct)}%` }} />
        </div>
        <Note>
          <SourceTag>INEC</SourceTag>
          <span>
            <AnimatedNumber value={noGpsPUs} /> with no GPS in INEC&apos;s register
          </span>
        </Note>
      </div>

      <div className={CARD}>
        <div className={LABEL}>{wardsCount !== undefined ? "Wards" : "Sub-units"}</div>
        <div className={`${VALUE} text-foreground`}>
          <AnimatedNumber value={wardsCount ?? (statesCount !== undefined ? statesCount : 1)} />
        </div>
        <Note>
          <SourceTag>INEC</SourceTag>
          <span>{wardsCount !== undefined ? "registration areas" : "administrative units"}</span>
        </Note>
      </div>

      <div className={CARD}>
        <div className={LABEL}>LGAs / Areas</div>
        <div className={`${VALUE} text-foreground`}>
          <AnimatedNumber value={lgasCount ?? (statesCount !== undefined ? statesCount : 1)} />
        </div>
        <Note>
          <SourceTag>INEC</SourceTag>
          <span>
            {statesCount !== undefined && statesCount > 1
              ? `${statesCount - 1} states + FCT`
              : "local govt councils"}
          </span>
        </Note>
      </div>

      <div className={CARD}>
        <div className={LABEL}>Official Coverage</div>
        <div className={`${VALUE} text-emerald-600 dark:text-emerald-400`}>
          <AnimatedNumber value={officialAgentPct} />%
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-1 rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-500"
            style={{ width: `${Math.min(100, officialAgentPct)}%` }}
          />
        </div>
        <Note>
          <span>
            <AnimatedNumber value={coveredPUs} /> of <AnimatedNumber value={totalPUs} /> covered ·{" "}
            <AnimatedNumber value={noCoveragePUs} /> gaps
          </span>
        </Note>
      </div>

      <div className={CARD}>
        <div className={LABEL}>Extra Agents</div>
        <div className={`${VALUE} text-violet-600 dark:text-violet-400`}>
          <AnimatedNumber value={extraAgentsCount} />
        </div>
        <Note>
          <span>Split by support group and candidate: Not available yet · not coverage</span>
        </Note>
      </div>
    </div>
  );
}
