"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send,
  Clock,
  Radio,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Bot,
  Zap,
  Calendar,
  FileEdit,
} from "lucide-react";

export interface ScheduleConfig {
  channelMode: "telegram_and_sms" | "telegram_only" | "sms_only";
  fallbackTimeoutMinutes: number;
  dispatchTiming: "immediate" | "scheduled" | "draft";
  scheduledDate: string;
  scheduledTime: string;
  requireDeliveryConfirmation: boolean;
}

interface StepScheduleProps {
  schedule: ScheduleConfig;
  onChange: (updated: ScheduleConfig) => void;
  totalRecipients: number;
}

export function StepSchedule({ schedule, onChange, totalRecipients }: StepScheduleProps) {
  return (
    <div className="space-y-6">
      {/* 1. Channel Routing Mode */}
      <Card className="border-border/80 shadow-xs bg-card">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Radio className="w-4 h-4 text-primary" />
                <span>Delivery Channel & Routing Policy</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Configure transmission priority and fallback routing.
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              Step 3 of 3
            </Badge>
          </div>

          <div className="space-y-3 pt-1">
            {/* Telegram + SMS Fallback */}
            <div
              onClick={() =>
                onChange({
                  ...schedule,
                  channelMode: "telegram_and_sms",
                })
              }
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                schedule.channelMode === "telegram_and_sms"
                  ? "bg-primary/5 border-primary/50 shadow-xs"
                  : "bg-muted/20 border-border hover:bg-muted/40"
              }`}
            >
              <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center mt-0.5 shrink-0">
                {schedule.channelMode === "telegram_and_sms" && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-foreground flex items-center gap-2">
                    <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Telegram Bot with Telco SMS Fallback</span>
                    <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0 h-4">
                      Recommended
                    </Badge>
                  </div>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                    Highest Delivery SLA
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Sends instantly via Telegram Bot (with rich action buttons). If the recipient does
                  not read or acknowledge within{" "}
                  <strong className="text-foreground">{schedule.fallbackTimeoutMinutes} minutes</strong>,
                  a Telco SMS alert is automatically triggered with a 1-tap confirmation link.
                </p>

                {schedule.channelMode === "telegram_and_sms" && (
                  <div className="pt-2 flex items-center gap-2">
                    <Label className="text-[11px] text-foreground font-semibold">
                      SMS Fallback Timeout:
                    </Label>
                    <Select
                      value={schedule.fallbackTimeoutMinutes.toString()}
                      onValueChange={(val) =>
                        val &&
                        onChange({
                          ...schedule,
                          fallbackTimeoutMinutes: parseInt(val, 10),
                        })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs w-[130px] bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 minutes</SelectItem>
                        <SelectItem value="5">5 minutes (Optimal)</SelectItem>
                        <SelectItem value="10">10 minutes</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Telegram Only */}
            <div
              onClick={() =>
                onChange({
                  ...schedule,
                  channelMode: "telegram_only",
                })
              }
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                schedule.channelMode === "telegram_only"
                  ? "bg-primary/5 border-primary/50 shadow-xs"
                  : "bg-muted/20 border-border hover:bg-muted/40"
              }`}
            >
              <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center mt-0.5 shrink-0">
                {schedule.channelMode === "telegram_only" && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-foreground flex items-center gap-2">
                    <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Telegram Bot Only</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-background">
                      Zero Cost
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Instant Interactive
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Sends directly to Telegram accounts linked to verified agent phone numbers. Fast and
                  free, but will not reach agents who haven't started the bot.
                </p>
              </div>
            </div>

            {/* Telco SMS Only */}
            <div
              onClick={() =>
                onChange({
                  ...schedule,
                  channelMode: "sms_only",
                })
              }
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                schedule.channelMode === "sms_only"
                  ? "bg-primary/5 border-primary/50 shadow-xs"
                  : "bg-muted/20 border-border hover:bg-muted/40"
              }`}
            >
              <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center mt-0.5 shrink-0">
                {schedule.channelMode === "sms_only" && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-foreground flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Telco Direct SMS Only</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Direct Carrier
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Dispatches traditional SMS text messages through national telecom gateways (MTN,
                  Airtel, Glo, 9mobile).
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Dispatch Timing & Schedule */}
      <Card className="border-border/80 shadow-xs bg-card">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span>Dispatch Timing</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Choose when this campaign should be broadcast.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Immediate */}
            <div
              onClick={() =>
                onChange({
                  ...schedule,
                  dispatchTiming: "immediate",
                })
              }
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                schedule.dispatchTiming === "immediate"
                  ? "bg-emerald-500/10 border-emerald-500/50 shadow-xs dark:bg-emerald-950/20"
                  : "bg-muted/20 border-border hover:bg-muted/40"
              }`}
            >
              <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-foreground">Send Immediately</div>
                <p className="text-[11px] text-muted-foreground">
                  Dispatches to all {totalRecipients.toLocaleString()} recipients right now.
                </p>
              </div>
            </div>

            {/* Scheduled */}
            <div
              onClick={() =>
                onChange({
                  ...schedule,
                  dispatchTiming: "scheduled",
                })
              }
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                schedule.dispatchTiming === "scheduled"
                  ? "bg-blue-500/10 border-blue-500/50 shadow-xs dark:bg-blue-950/20"
                  : "bg-muted/20 border-border hover:bg-muted/40"
              }`}
            >
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-foreground">Schedule for Later</div>
                <p className="text-[11px] text-muted-foreground">
                  Set a specific future date and time in WAT (West Africa Time).
                </p>
              </div>
            </div>

            {/* Draft */}
            <div
              onClick={() =>
                onChange({
                  ...schedule,
                  dispatchTiming: "draft",
                })
              }
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                schedule.dispatchTiming === "draft"
                  ? "bg-slate-500/10 border-slate-500/50 shadow-xs dark:bg-slate-900/40"
                  : "bg-muted/20 border-border hover:bg-muted/40"
              }`}
            >
              <FileEdit className="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-foreground">Save as Draft</div>
                <p className="text-[11px] text-muted-foreground">
                  Store template and audience without queueing for broadcast.
                </p>
              </div>
            </div>
          </div>

          {/* Date & Time Pickers for Scheduled */}
          {schedule.dispatchTiming === "scheduled" && (
            <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Scheduled Date (WAT)</Label>
                <Input
                  type="date"
                  value={schedule.scheduledDate}
                  onChange={(e) =>
                    onChange({
                      ...schedule,
                      scheduledDate: e.target.value,
                    })
                  }
                  className="h-9 text-xs bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Scheduled Time (WAT)</Label>
                <Input
                  type="time"
                  value={schedule.scheduledTime}
                  onChange={(e) =>
                    onChange({
                      ...schedule,
                      scheduledTime: e.target.value,
                    })
                  }
                  className="h-9 text-xs bg-background"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
