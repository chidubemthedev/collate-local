"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Send, MapPin, Calendar, CheckCircle2 } from "lucide-react";
import { MessageConfig } from "./step-message";
import { ScheduleConfig } from "./step-schedule";

interface LivePreviewProps {
  message: MessageConfig;
  schedule: ScheduleConfig;
  targetAreaLabel: string;
  totalRecipients: number | null;
  isLoadingRecipients?: boolean;
}

export function LivePreview({
  message,
  schedule,
  targetAreaLabel,
  totalRecipients,
  isLoadingRecipients = false,
}: LivePreviewProps) {
  const previewBody = (message.body || "Your message preview will appear here.")
    .replace(/\{\{recipient_name\}\}/g, "[recipient name]")
    .replace(/\{\{agent_name\}\}/g, "[agent name]")
    .replace(/\{\{pu_code\}\}/g, "[polling unit code]")
    .replace(/\{\{pu_name\}\}/g, "[polling unit name]")
    .replace(/\{\{ward_name\}\}/g, "[ward name]")
    .replace(/\{\{lga_name\}\}/g, "[LGA name]")
    .replace(/\{\{area_name\}\}/g, targetAreaLabel)
    .replace(/\{\{state_name\}\}/g, "[state name]");

  return (
    <div className="sticky top-6 space-y-3">
      {/* Unified Flat Preview Panel */}
      <div className="border border-border/70 rounded-xl bg-card overflow-hidden">
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Eye className="h-3.5 w-3.5 text-primary" />
            <span>Message Preview</span>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
          >
            Telegram Dispatch
          </Badge>
        </div>

        {/* Message Content Bubble */}
        <div className="p-4">
          <div className="min-h-[180px] whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/20 p-3.5 text-xs leading-relaxed text-foreground font-sans">
            {previewBody}
          </div>
        </div>

        {/* Target Destination & Schedule Footer */}
        <div className="border-t border-border/60 bg-muted/10 p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2 font-bold text-foreground">
            <span className="flex items-center gap-1.5 text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">
              <Send className="w-3 h-3 text-primary" />
              Target Destination
            </span>
            {isLoadingRecipients ? (
              <Skeleton className="h-4 w-20 rounded" />
            ) : (
              <span className="font-mono text-primary font-bold">
                {totalRecipients === null ? "—" : totalRecipients.toLocaleString()} recipients
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <MapPin className="w-3 h-3 shrink-0 text-muted-foreground" />
            <span>Scope:</span>
            <strong className="text-foreground font-medium truncate">{targetAreaLabel}</strong>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Calendar className="w-3 h-3 shrink-0 text-muted-foreground" />
            <span>
              {schedule.dispatchTiming === "immediate"
                ? "Send immediately upon queuing"
                : `Scheduled for ${schedule.scheduledDate || "—"} at ${schedule.scheduledTime || "—"}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
