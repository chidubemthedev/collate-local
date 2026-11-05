"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import type { AgentSummary } from "@/types/api";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { StatTile, LoadingBox } from "@/components/ui/wf";

interface RecipientsKPISummaryProps {
  summary: AgentSummary | undefined;
  /** NDC candidates whose seat overlaps the chosen area; undefined while unknown. */
  candidateCount: number | undefined;
  isLoading: boolean;
  isRefreshing: boolean;
  isError: boolean;
  onRetry: () => void;
}

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

export function RecipientsKPISummary({
  summary,
  candidateCount,
  isLoading,
  isRefreshing,
  isError,
  onRetry,
}: RecipientsKPISummaryProps) {
  if (isError && !summary) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 rounded-[10px] border border-[#F5C2C0] bg-[#FDECEC] p-3 text-[13px] text-[#B42318]"
      >
        <span>Could not load the totals.</span>
        <button type="button" className="border-0 bg-transparent font-semibold underline" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (isLoading && !summary) {
    return <LoadingBox>Loading the totals…</LoadingBox>;
  }

  const value = (count: number | undefined) =>
    count === undefined ? (
      <Loader2 className="mt-1.5 h-5 w-5 animate-spin text-[#A3A3A3]" aria-label="Loading" />
    ) : (
      <AnimatedNumber value={count} />
    );

  const total = summary?.total ?? 0;

  return (
    <section
      aria-label="Summary"
      aria-busy={isRefreshing}
      className={`grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2 transition-opacity sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] sm:gap-3 ${
        isRefreshing ? "opacity-60" : ""
      }`}
    >
      <StatTile label="NDC candidates" value={value(candidateCount)} inec note="names from INEC lists" />
      <StatTile label="Official agents" value={value(summary?.official)} note="one per covered unit" />
      <StatTile label="Extra agents" value={value(summary?.extra)} color="#1E8A55" note="support groups and candidates" />
      <StatTile
        label="On Telegram"
        value={value(summary?.telegramConnected)}
        color="#1E8A55"
        note={`${pct(summary?.telegramConnected ?? 0, total)}% of listed`}
      />
      <StatTile label="SMS only" value={value(summary?.smsOnly)} color="#525252" note="not on Telegram yet" />
      <StatTile
        label="Not matched"
        value={value(summary?.notMatched)}
        color="#9B1C1C"
        note="no confirmed number: gets no messages"
      />
    </section>
  );
}
