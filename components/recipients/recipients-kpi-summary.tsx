"use client";

import React from "react";
import { RecipientPerson } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Bot,
  Smartphone,
  AlertCircle,
  ShieldCheck,
  UserCheck,
  Award,
} from "lucide-react";

interface RecipientsKPISummaryProps {
  recipients: RecipientPerson[];
}

export function RecipientsKPISummary({ recipients }: RecipientsKPISummaryProps) {
  const total = recipients.length;
  const telegramConnected = recipients.filter(
    (r) => r.telegramStatus === "Telegram connected"
  ).length;
  const smsOnly = recipients.filter((r) => r.telegramStatus === "SMS only").length;
  const notMatched = recipients.filter(
    (r) => r.telegramStatus === "Number not matched"
  ).length;

  const telegramPct = total > 0 ? Math.round((telegramConnected / total) * 100) : 0;
  const smsPct = total > 0 ? Math.round((smsOnly / total) * 100) : 0;
  const notMatchedPct = total > 0 ? Math.round((notMatched / total) * 100) : 0;

  const candidatesCount = recipients.filter((r) => r.group.includes("NDC ·")).length;
  const officialCount = recipients.filter((r) => r.group.toLowerCase().includes("official")).length;
  const extraCount = recipients.filter((r) => r.group.toLowerCase().includes("extra")).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
      {/* 1. Total Registered Card */}
      <Card className="border-border/80 shadow-xs bg-card hover:border-border transition-colors">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
              Total Personnel
            </span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
              {total.toLocaleString()}
            </span>
            <Badge variant="outline" className="text-[11px] font-medium bg-muted/50">
              Listed
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            {candidatesCount} Tickets · {officialCount} Official · {extraCount} Extra
          </p>
        </CardContent>
      </Card>

      {/* 2. Telegram Connected Card */}
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
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
              {telegramConnected.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-muted-foreground font-mono">
              ({telegramPct}%)
            </span>
          </div>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
            Direct bot uplink active
          </p>
        </CardContent>
      </Card>

      {/* 3. SMS Only Card */}
      <Card className="border-border/80 shadow-xs bg-card hover:border-border transition-colors">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
              SMS Fallback Ready
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400 font-mono">
              {smsOnly.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-muted-foreground font-mono">
              ({smsPct}%)
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Receives carrier SMS fallback
          </p>
        </CardContent>
      </Card>

      {/* 4. Number Not Matched Card */}
      <Card className="border-border/80 shadow-xs bg-card hover:border-border transition-colors">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
              Number Not Matched
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400 font-mono">
              {notMatched.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-muted-foreground font-mono">
              ({notMatchedPct}%)
            </span>
          </div>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-medium">
            Requires phone verification
          </p>
        </CardContent>
      </Card>

      {/* 5. Channel Policy Overview Card */}
      <Card className="col-span-2 md:col-span-4 lg:col-span-1 border-border/80 shadow-xs bg-card hover:border-border transition-colors">
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
              <span className="text-muted-foreground">Deliverability SLA:</span>
              <span className="font-bold text-foreground font-mono">
                {telegramPct + smsPct}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden flex">
              <div style={{ width: `${telegramPct}%` }} className="bg-emerald-500" />
              <div style={{ width: `${smsPct}%` }} className="bg-blue-500" />
              <div style={{ width: `${notMatchedPct}%` }} className="bg-amber-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
