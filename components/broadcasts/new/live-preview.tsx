"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import { MessageConfig } from "./step-message";
import { ScheduleConfig } from "./step-schedule";

interface LivePreviewProps {
  message: MessageConfig;
  schedule: ScheduleConfig;
  targetAreaLabel: string;
  totalRecipients: number | null;
}

export function LivePreview({
  message,
  schedule,
  targetAreaLabel,
  totalRecipients,
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
    <div className="sticky top-6 space-y-4">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Eye className="h-3.5 w-3.5 text-primary" />
        <span>Message preview</span>
      </div>

      <Card className="overflow-hidden border-border/80 bg-card shadow-md">
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2 text-[11px] text-muted-foreground">
          <span>Message body</span>
          <Badge variant="outline" className="text-[10px]">
            Dispatch API
          </Badge>
        </div>
        <CardContent className="p-4">
          <div className="min-h-48 whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-3.5 text-xs leading-relaxed text-foreground">
            {previewBody}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-1.5 rounded-xl border border-border bg-card p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2 font-bold text-foreground">
          <span>Target destination</span>
          <span className="font-mono text-primary">
            {totalRecipients === null ? "—" : totalRecipients.toLocaleString()} recipients
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          Scope: <strong>{targetAreaLabel}</strong>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {schedule.dispatchTiming === "immediate"
            ? "Send immediately"
            : `Scheduled for ${schedule.scheduledDate} at ${schedule.scheduledTime}`}
        </div>
      </div>
    </div>
  );
}
