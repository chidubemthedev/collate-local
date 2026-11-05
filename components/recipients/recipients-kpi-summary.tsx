"use client";

import React from "react";
import type { AgentSummary } from "@/types/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Users, Bot, AlertCircle, Award } from "lucide-react";

interface RecipientsKPISummaryProps {
  summary: AgentSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

const pct = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

export function RecipientsKPISummary({
  summary,
  isLoading,
  isError,
  onRetry,
}: RecipientsKPISummaryProps) {
  if (isError) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive"
      >
        <span>Could not load recipient totals.</span>
        <button type="button" className="font-semibold underline" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  const total = summary?.total ?? 0;
  const connected = summary?.telegramConnected ?? 0;
  const notConnected = summary?.notConnected ?? 0;
  const connectedPct = pct(connected, total);
  const notConnectedPct = pct(notConnected, total);
  const pending = isLoading && !summary;
  const hasData =
    typeof summary?.total === "number" &&
    typeof summary.official === "number" &&
    typeof summary.extra === "number" &&
    typeof summary.telegramConnected === "number" &&
    typeof summary.notConnected === "number";

  if (!pending && !hasData) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-4 text-xs text-muted-foreground">
        Not available yet
      </div>
    );
  }

  const value = (count: number, className: string) =>
    pending ? (
      <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted" />
    ) : (
      <AnimatedNumber value={count} className={className} />
    );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      <Card className="border-border/80 shadow-xs bg-card hover:border-border transition-colors">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
              Total Agents
            </span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            {value(total, "text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono")}
            <Badge variant="outline" className="text-[11px] font-medium bg-muted/50">
              Listed
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            {pending
              ? "Loading…"
              : `${(summary?.official ?? 0).toLocaleString()} Official · ${(summary?.extra ?? 0).toLocaleString()} Extra`}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-xs bg-card hover:border-border transition-colors">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
              Telegram Connected
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            {value(connected, "text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono")}
            <span className="text-xs font-semibold text-muted-foreground font-mono">
              ({connectedPct}%)
            </span>
          </div>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
            Linked and consented
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-xs bg-card hover:border-border transition-colors">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
              Not Connected
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            {value(notConnected, "text-2xl sm:text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400 font-mono")}
            <span className="text-xs font-semibold text-muted-foreground font-mono">
              ({notConnectedPct}%)
            </span>
          </div>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-medium">
            Not yet linked or consented
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-xs bg-card hover:border-border transition-colors">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
              Channel Readiness
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Telegram reach:</span>
              <span className="font-bold text-foreground font-mono">{connectedPct}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden flex">
              <div style={{ width: `${connectedPct}%` }} className="bg-emerald-500" />
              <div style={{ width: `${notConnectedPct}%` }} className="bg-amber-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
