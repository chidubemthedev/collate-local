"use client";

import React from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { InecTag } from "@/components/ui/wf";

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

/** One summary tile from the wireframes: label, value on a shared baseline, optional bar, note. */
function Tile({
  label,
  value,
  suffix,
  bar,
  fill = "#0A0A0A",
  color = "#0A0A0A",
  inec = false,
  note,
}: {
  label: string;
  value: React.ReactNode;
  suffix?: React.ReactNode;
  bar?: number;
  fill?: string;
  color?: string;
  inec?: boolean;
  note: React.ReactNode;
}) {
  const hasBar = typeof bar === "number";
  return (
    <div className="flex min-w-0 flex-col rounded-[14px] border border-[#E5E5E5] bg-white p-3.5">
      <span className="block h-[18px] truncate text-[12px] font-medium text-[#525252]">{label}</span>
      <span className="mt-2.5 flex h-8 items-baseline gap-1.5">
        <span className="text-[24px] leading-8 font-bold tabular-nums" style={{ color }}>
          {value}
        </span>
        {suffix ? <span className="text-[12px] whitespace-nowrap tabular-nums text-[#737373]">{suffix}</span> : null}
      </span>
      <span
        className="mt-1.5 block h-1 overflow-hidden rounded-[2px]"
        style={{ background: hasBar ? "#F0F0F0" : "transparent" }}
      >
        {hasBar ? (
          <span
            className="block h-1 transition-[width] duration-500"
            style={{ width: `${Math.min(100, Math.max(0, bar))}%`, background: fill }}
          />
        ) : null}
      </span>
      <span className="mt-2 text-[11px] leading-[15px] text-[#737373]">
        {inec ? (
          <>
            <InecTag />{" "}
          </>
        ) : null}
        {note}
      </span>
    </div>
  );
}

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
  const national = statesCount !== undefined;

  return (
    <section
      aria-label="Summary"
      className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] sm:gap-3"
    >
      <Tile
        label="Polling Units"
        value={<AnimatedNumber value={totalPUs} />}
        inec
        note={national ? "INEC register total" : "in this area"}
      />
      <Tile
        label="With GPS Position"
        value={<AnimatedNumber value={gpsPUs} />}
        suffix={<>{gpsPct}%</>}
        bar={gpsPct}
        inec
        note={
          <>
            <AnimatedNumber value={noGpsPUs} /> with no GPS in INEC&rsquo;s register
          </>
        }
      />
      <Tile
        label="Wards"
        value={<AnimatedNumber value={wardsCount ?? 1} />}
        inec
        note="registration areas"
      />
      <Tile
        label="LGAs / Areas"
        value={<AnimatedNumber value={lgasCount ?? 1} />}
        inec
        note={national && statesCount > 1 ? `${statesCount - 1} states + FCT` : "in this area"}
      />
      <Tile
        label="Official Coverage"
        value={
          <>
            <AnimatedNumber value={officialAgentPct} />%
          </>
        }
        bar={officialAgentPct}
        fill="#22A06B"
        color="#1E8A55"
        note={
          <>
            <AnimatedNumber value={coveredPUs} /> of <AnimatedNumber value={totalPUs} /> covered ·{" "}
            <AnimatedNumber value={noCoveragePUs} /> gaps
          </>
        }
      />
      <Tile
        label="Extra Agents"
        value={<AnimatedNumber value={extraAgentsCount} />}
        color="#6D28D9"
        note="support groups and candidates · not coverage"
      />
    </section>
  );
}
