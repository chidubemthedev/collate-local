"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Users, Bot, MessageSquare, Lock } from "lucide-react";

interface SettingsKPISummaryProps {
  totalGroups: number;
  customGroupsCount: number;
  telegramStatus: string;
  smsBalance: string;
  phoneMaskingEnabled: boolean;
  totalAuditEvents: number;
}

export function SettingsKPISummary({
  totalGroups,
  customGroupsCount,
  telegramStatus,
  smsBalance,
  phoneMaskingEnabled,
  totalAuditEvents,
}: SettingsKPISummaryProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {/* Access Groups Card */}
      <Card className="shadow-xs hover:border-emerald-200 transition-all border-slate-200">
        <CardContent className="p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Access Groups</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-900 tracking-tight">{totalGroups}</span>
            <Badge variant="outline" className="bg-emerald-50/50 text-emerald-800 border-emerald-200 text-[10px] font-semibold px-1.5 py-0">
              {customGroupsCount} Custom
            </Badge>
          </div>
          <p className="text-[11px] text-slate-500 truncate">4 Core System Roles</p>
        </CardContent>
      </Card>

      {/* Telegram Bot Card */}
      <Card className="shadow-xs hover:border-blue-200 transition-all border-slate-200">
        <CardContent className="p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Telegram Bot</span>
            <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Bot className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-900 tracking-tight">@NDCPollingUnitBot</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-blue-700 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
            <span>{telegramStatus}</span>
          </div>
        </CardContent>
      </Card>

      {/* SMS Fallback Gateway Card */}
      <Card className="shadow-xs hover:border-amber-200 transition-all border-slate-200">
        <CardContent className="p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">SMS Gateway Balance</span>
            <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-900 tracking-tight">{smsBalance}</span>
          </div>
          <p className="text-[11px] text-slate-500 truncate">Termii NG · DND Priority Route</p>
        </CardContent>
      </Card>

      {/* NDPA Secrecy & Privacy Card */}
      <Card className="shadow-xs hover:border-purple-200 transition-all border-slate-200">
        <CardContent className="p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">NDPA 2023 Secrecy</span>
            <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Lock className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-purple-900 tracking-tight">
              {phoneMaskingEnabled ? "Masked" : "Unmasked"}
            </span>
            <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 text-[10px] font-semibold px-1.5 py-0">
              s.30 Active
            </Badge>
          </div>
          <p className="text-[11px] text-slate-500 truncate">Agent phone secrecy enforced</p>
        </CardContent>
      </Card>

      {/* Security Audit Trail Card */}
      <Card className="col-span-2 md:col-span-3 lg:col-span-1 shadow-xs hover:border-slate-300 transition-all border-slate-200">
        <CardContent className="p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Audit Trail</span>
            <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              {totalAuditEvents.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 font-normal">Events</span>
          </div>
          <p className="text-[11px] text-slate-500 truncate">365-day immutable log</p>
        </CardContent>
      </Card>
    </div>
  );
}
