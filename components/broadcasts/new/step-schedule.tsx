"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar, Clock, FileEdit, Radio, Send } from "lucide-react";

export interface ScheduleConfig {
  dispatchTiming: "immediate" | "scheduled";
  scheduledDate: string;
  scheduledTime: string;
}

interface StepScheduleProps {
  schedule: ScheduleConfig;
  onChange: (updated: ScheduleConfig) => void;
  totalRecipients: number;
}

export function StepSchedule({ schedule, onChange, totalRecipients }: StepScheduleProps) {
  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card shadow-xs">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Radio className="h-4 w-4 text-primary" />
                <span>Delivery Channel</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Channel selection is not supported by the broadcast API.
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              Not available yet
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card shadow-xs">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="space-y-0.5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              <span>Dispatch Timing</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Choose whether to queue the broadcast now or at a future time.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              aria-pressed={schedule.dispatchTiming === "immediate"}
              onClick={() => onChange({ ...schedule, dispatchTiming: "immediate" })}
              className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                schedule.dispatchTiming === "immediate"
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : "border-border bg-muted/20 hover:bg-muted/40"
              }`}
            >
              <Send className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span className="space-y-0.5">
                <span className="block text-xs font-bold text-foreground">Send Immediately</span>
                <span className="block text-[11px] text-muted-foreground">
                  Queue for {totalRecipients.toLocaleString()} recipients now.
                </span>
              </span>
            </button>

            <button
              type="button"
              aria-pressed={schedule.dispatchTiming === "scheduled"}
              onClick={() => onChange({ ...schedule, dispatchTiming: "scheduled" })}
              className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                schedule.dispatchTiming === "scheduled"
                  ? "border-blue-500/50 bg-blue-500/10"
                  : "border-border bg-muted/20 hover:bg-muted/40"
              }`}
            >
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <span className="space-y-0.5">
                <span className="block text-xs font-bold text-foreground">Schedule for Later</span>
                <span className="block text-[11px] text-muted-foreground">
                  Set a future date and time.
                </span>
              </span>
            </button>

            <button
              type="button"
              disabled
              title="Not available yet"
              className="flex cursor-not-allowed items-start gap-3 rounded-xl border border-border bg-muted/20 p-3.5 text-left opacity-70"
            >
              <FileEdit className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="space-y-0.5">
                <span className="block text-xs font-bold text-foreground">
                  Save as Draft · Not available yet
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  Draft broadcasts are not supported by the API.
                </span>
              </span>
            </button>
          </div>

          {schedule.dispatchTiming === "scheduled" && (
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 sm:grid-cols-2 dark:border-blue-900 dark:bg-blue-950/20">
              <div className="space-y-1.5">
                <Label htmlFor="broadcast-scheduled-date" className="text-xs font-semibold">
                  Scheduled Date
                </Label>
                <Input
                  id="broadcast-scheduled-date"
                  type="date"
                  value={schedule.scheduledDate}
                  onChange={(event) =>
                    onChange({ ...schedule, scheduledDate: event.target.value })
                  }
                  className="h-9 bg-background text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="broadcast-scheduled-time" className="text-xs font-semibold">
                  Scheduled Time
                </Label>
                <Input
                  id="broadcast-scheduled-time"
                  type="time"
                  value={schedule.scheduledTime}
                  onChange={(event) =>
                    onChange({ ...schedule, scheduledTime: event.target.value })
                  }
                  className="h-9 bg-background text-xs"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
