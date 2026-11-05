"use client";

import React from "react";
import type { AgentSummary } from "@/types/api";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { StatCardSkeleton } from "@/components/ui/skeleton";

interface RecipientsKPISummaryProps {
  summary: AgentSummary | undefined;
  /** NDC candidates whose seat overlaps the chosen area; undefined while unknown. */
  candidateCount: number | undefined;
  isLoading: boolean;
  isRefreshing: boolean;
  isError: boolean;
  onRetry: () => void;
}

const CARD = "flex h-full flex-col rounded-xl border border-border/60 bg-card p-4";
const LABEL = "text-[11px] font-medium text-foreground/80";
const VALUE = "mt-3 text-xl md:text-2xl font-bold tracking-tight tabular-nums";
const NOTE = "mt-3 flex flex-wrap items-center gap-1.5 text-[10px] leading-snug text-muted-foreground";

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
        className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive"
      >
        <span>Could not load the totals.</span>
        <button type="button" className="font-semibold underline" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  // Same first-load skeleton as the other card rows.
  if (isLoading && !summary) {
    return <StatCardSkeleton count={6} className="grid-cols-2 md:grid-cols-3 lg:grid-cols-6" />;
  }

  const value = (count: number | undefined, colour: string) =>
    count === undefined ? (
      <span className="inline-block h-7 w-14 animate-pulse rounded bg-muted" />
    ) : (
      <span className={colour}>
        <AnimatedNumber value={count} />
      </span>
    );

  const total = summary?.total ?? 0;

  return (
    <div
      aria-busy={isRefreshing}
      className={`grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6 transition-opacity ${isRefreshing ? "opacity-60" : ""}`}
    >
      <div className={CARD}>
        <div className={LABEL}>NDC candidates</div>
        <div className={VALUE}>{value(candidateCount, "text-foreground")}</div>
        <div className={NOTE}>
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold leading-none text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            INEC
          </span>
          <span>names from INEC lists</span>
        </div>
      </div>

      <div className={CARD}>
        <div className={LABEL}>Official agents</div>
        <div className={VALUE}>{value(summary?.official, "text-foreground")}</div>
        <div className={NOTE}>one per covered unit</div>
      </div>

      <div className={CARD}>
        <div className={LABEL}>Extra agents</div>
        <div className={VALUE}>{value(summary?.extra, "text-emerald-600 dark:text-emerald-400")}</div>
        <div className={NOTE}>support groups and candidates</div>
      </div>

      <div className={CARD}>
        <div className={LABEL}>On Telegram</div>
        <div className={VALUE}>{value(summary?.telegramConnected, "text-emerald-600 dark:text-emerald-400")}</div>
        <div className={NOTE}>{pct(summary?.telegramConnected ?? 0, total)}% of listed</div>
      </div>

      <div className={CARD}>
        <div className={LABEL}>SMS only</div>
        <div className={VALUE}>{value(summary?.smsOnly, "text-foreground/70")}</div>
        <div className={NOTE}>not on Telegram yet</div>
      </div>

      <div className={CARD}>
        <div className={LABEL}>Not matched</div>
        <div className={VALUE}>{value(summary?.notMatched, "text-red-700 dark:text-red-400")}</div>
        <div className={NOTE}>no confirmed number: gets no messages</div>
      </div>
    </div>
  );
}
