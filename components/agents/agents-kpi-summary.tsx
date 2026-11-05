"use client";

import React from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { StatTile } from "@/components/ui/wf";

interface AgentsKPISummaryProps {
  totalPUs: number;
  officialCount: number;
  extraCount: number;
  gapsCount: number;
  /** The area the numbers cover, e.g. "Nigeria" or a state name. */
  areaName: string;
}

export function AgentsKPISummary({ totalPUs, officialCount, extraCount, gapsCount, areaName }: AgentsKPISummaryProps) {
  const officialPct = totalPUs > 0 ? Math.round((officialCount / totalPUs) * 100) : 0;
  const gapsPct = totalPUs > 0 ? Math.round((gapsCount / totalPUs) * 100) : 0;

  return (
    <section
      aria-label="Summary"
      className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fit,minmax(190px,1fr))] sm:gap-3"
    >
      <StatTile label="Polling Units" value={<AnimatedNumber value={totalPUs} />} inec note={`in ${areaName}`} />
      <StatTile
        label="Official Party Agents"
        value={<AnimatedNumber value={officialCount} />}
        suffix={
          <>
            <AnimatedNumber value={officialPct} />% coverage
          </>
        }
        color="#1E8A55"
        note="one per unit = covered"
      />
      <StatTile
        label="Extra Agents"
        value={<AnimatedNumber value={extraCount} />}
        color="#6D28D9"
        note="support groups and candidates · never coverage"
      />
      <StatTile
        label="Coverage Gaps"
        value={<AnimatedNumber value={gapsCount} />}
        suffix={
          <>
            <AnimatedNumber value={gapsPct} />%
          </>
        }
        color="#8A3F08"
        note="units with no official agent"
      />
    </section>
  );
}
