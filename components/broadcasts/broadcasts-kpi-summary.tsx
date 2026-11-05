"use client";

import React from "react";
import { BroadcastData } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  CheckCircle2,
  Radio,
  TrendingUp,
  MessageSquare,
  CheckCheck,
} from "lucide-react";

interface BroadcastsKPISummaryProps {
  broadcasts: BroadcastData[];
}

export function BroadcastsKPISummary({ broadcasts }: BroadcastsKPISummaryProps) {
  // Compute metrics from dataset
  const totalCount = broadcasts.length;
  const sentCount = broadcasts.filter((b) => b.status === "Sent").length;
  const scheduledCount = broadcasts.filter((b) => b.status === "Scheduled").length;
  const draftCount = broadcasts.filter((b) => b.status === "Draft").length;

  const sentBroadcasts = broadcasts.filter((b) => b.status === "Sent");
  const totalSentMessages = sentBroadcasts.reduce((sum, b) => sum + b.sent, 0);
  const totalDeliveredMessages = sentBroadcasts.reduce((sum, b) => sum + b.delivered, 0);
  const totalTappedOk = sentBroadcasts.reduce((sum, b) => sum + b.tappedOk, 0);

  const avgDeliveryPct =
    totalSentMessages > 0 ? Math.round((totalDeliveredMessages / totalSentMessages) * 100) : 0;
  const avgTappedOkPct =
    totalDeliveredMessages > 0 ? Math.round((totalTappedOk / totalDeliveredMessages) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
      {/* 1. Total Broadcasts Card */}
      <div className="bg-card border border-border/70 rounded-xl p-3.5 sm:p-4 hover:border-border transition-colors space-y-2">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Total Campaigns
          </span>
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Send className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
            {totalCount}
          </span>
          <Badge variant="outline" className="text-[10px] font-medium bg-muted/50 border-muted/80">
            {sentCount} sent
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-0.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span>{scheduledCount} scheduled · {draftCount} draft</span>
        </p>
      </div>

      {/* 2. Dispatches Reached Card */}
      <div className="bg-card border border-border/70 rounded-xl p-3.5 sm:p-4 hover:border-border transition-colors space-y-2">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Dispatches Sent
          </span>
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
            {totalSentMessages.toLocaleString()}
          </span>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1 pt-0.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="truncate">{totalDeliveredMessages.toLocaleString()} confirmed delivered</span>
        </p>
      </div>

      {/* 3. Delivery Rate Card */}
      <div className="bg-card border border-border/70 rounded-xl p-3.5 sm:p-4 hover:border-border transition-colors space-y-2">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Delivery Rate
          </span>
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
            {avgDeliveryPct}%
          </span>
          <Badge
            variant="outline"
            className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
          >
            High SLA
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-0.5">
          <Radio className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate">Direct Telegram bot dispatch</span>
        </p>
      </div>

      {/* 4. Tapped "OK" Acknowledgment Card */}
      <div className="bg-card border border-border/70 rounded-xl p-3.5 sm:p-4 hover:border-border transition-colors space-y-2">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Acknowledged (OK)
          </span>
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <CheckCheck className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
            {avgTappedOkPct}%
          </span>
          <span className="text-xs font-medium text-muted-foreground font-mono">
            ({totalTappedOk.toLocaleString()})
          </span>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1 pt-0.5">
          <span className="text-primary font-medium">1-tap button</span>
          <span className="truncate">interactive confirmations</span>
        </p>
      </div>

      {/* 5. Channel Status Card (Span 2 on mobile, 1 on desktop) */}
      <div className="col-span-2 md:col-span-4 lg:col-span-1 bg-card border border-border/70 rounded-xl p-3.5 sm:p-4 hover:border-border transition-colors space-y-2">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Channel Status
          </span>
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 pt-0.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Telegram Bot
            </span>
            <span className="text-emerald-600 font-mono text-[11px] font-semibold">Live · Ready</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
              <CheckCircle2 className="w-3 h-3 text-primary" />
              <span>1-Tap Confirm</span>
            </span>
            <span className="text-muted-foreground font-mono text-[11px]">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
