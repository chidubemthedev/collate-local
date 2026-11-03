"use client";

import React from "react";
import { BroadcastData } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  CheckCircle2,
  CheckCheck,
  Clock,
  AlertTriangle,
  Radio,
  Send,
} from "lucide-react";

interface ReportKPISummaryProps {
  broadcast: BroadcastData;
}

export function ReportKPISummary({ broadcast }: ReportKPISummaryProps) {
  const total = broadcast.sent || 1;
  const deliveredPct = broadcast.deliveredPct || Math.round((broadcast.delivered / total) * 100);
  const tappedOkPct = broadcast.tappedOkPct || Math.round((broadcast.tappedOk / total) * 100);

  const deliveredWidth = Math.min(100, Math.round((broadcast.delivered / total) * 100));
  const pendingWidth = Math.min(100, Math.round((broadcast.pending / total) * 100));
  const failedWidth = Math.min(100, Math.round((broadcast.failed / total) * 100));

  return (
    <div className="space-y-4">
      {/* 5-Column Metric Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* 1. Total Target Dispatches */}
        <Card className="border-border/80 shadow-xs bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                Target Dispatches
              </span>
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
                {broadcast.sent.toLocaleString()}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 truncate">
              {broadcast.candidatesCount > 0 && `${broadcast.candidatesCount} Candidates`}
              {broadcast.candidatesCount > 0 && broadcast.agentsCount > 0 && " + "}
              {broadcast.agentsCount > 0 && `${broadcast.agentsCount} Agents`}
            </p>
          </CardContent>
        </Card>

        {/* 2. Total Delivered */}
        <Card className="border-border/80 shadow-xs bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                Delivered
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
                {broadcast.delivered.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-muted-foreground font-mono">
                ({deliveredPct}%)
              </span>
            </div>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
              Confirmed at device
            </p>
          </CardContent>
        </Card>

        {/* 3. Acknowledged (Tapped OK) */}
        <Card className="border-border/80 shadow-xs bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                Acknowledged (OK)
              </span>
              <CheckCheck className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-primary font-mono">
                {broadcast.tappedOk.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-muted-foreground font-mono">
                ({tappedOkPct}%)
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Interactive bot replies
            </p>
          </CardContent>
        </Card>

        {/* 4. Telegram Direct Route */}
        <Card className="border-border/80 shadow-xs bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                Channel
              </span>
              <Radio className="w-4 h-4 text-sky-500 animate-pulse" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground font-mono">
                Telegram
              </span>
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
              Verified Command Bot
            </p>
          </CardContent>
        </Card>

        {/* 5. Pending & Failed */}
        <Card className="col-span-2 md:col-span-1 border-border/80 shadow-xs bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                Pending / Failed
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400 font-mono">
                {broadcast.failed}
              </span>
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 font-mono">
                ({broadcast.pending} pending)
              </span>
            </div>
            <p className="text-[11px] text-rose-600/90 dark:text-rose-400/90 mt-1 font-medium">
              Network timeouts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Visual Multi-Segment Progress Bar */}
      <Card className="border-border/80 shadow-xs bg-card">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              <span>Real-Time Broadcast Delivery Progress</span>
            </span>
            <span className="font-mono text-muted-foreground font-semibold">
              {broadcast.delivered} / {broadcast.sent} Delivered ({deliveredPct}%)
            </span>
          </div>

          <div className="w-full h-3 rounded-full bg-muted/80 overflow-hidden flex shadow-inner">
            <div
              style={{ width: `${deliveredWidth}%` }}
              className="h-full bg-emerald-500 transition-all duration-500"
              title={`Delivered: ${broadcast.delivered}`}
            />
            <div
              style={{ width: `${pendingWidth}%` }}
              className="h-full bg-amber-400 transition-all duration-500"
              title={`Pending: ${broadcast.pending}`}
            />
            <div
              style={{ width: `${failedWidth}%` }}
              className="h-full bg-rose-500 transition-all duration-500"
              title={`Failed: ${broadcast.failed}`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground pt-1">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-foreground font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Delivered: <strong>{broadcast.delivered}</strong>
              </span>
              {broadcast.pending > 0 && (
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Pending: <strong>{broadcast.pending}</strong>
                </span>
              )}
              {broadcast.failed > 0 && (
                <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Failed: <strong>{broadcast.failed}</strong>
                </span>
              )}
            </div>

            <span className="text-primary font-semibold flex items-center gap-1">
              <CheckCheck className="w-3.5 h-3.5" />
              <span>{broadcast.tappedOk} OK Confirmations ({tappedOkPct}%)</span>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
