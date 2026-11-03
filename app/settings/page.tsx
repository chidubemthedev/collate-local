"use client";

import React, { useState } from "react";
import { usePermissions } from "@/lib/hooks/use-auth";
import { AccessGroup } from "@/lib/types";
import { ACCESS_GROUPS_DATA } from "@/lib/data/settings-data";
import { SettingsKPISummary } from "@/components/settings/settings-kpi-summary";
import { AccessMatrixTable } from "@/components/settings/access-matrix-table";
import { AccessGroupsManager } from "@/components/settings/access-groups-manager";
import { ChannelGatewaySettings } from "@/components/settings/channel-gateway-settings";
import { SecurityPrivacySettings } from "@/components/settings/security-privacy-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton, StatCardSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import {
  Settings,
  Shield,
  Users,
  Radio,
  Lock,
  Plus,
  AlertCircle,
} from "lucide-react";

export default function SettingsPage() {
  const { data: permissions, error, isError, isLoading, refetch } = usePermissions();
  const [activeTab, setActiveTab] = useState<"matrix" | "custom" | "gateways" | "security">("matrix");
  const [allGroups] = useState<AccessGroup[]>(ACCESS_GROUPS_DATA);

  const customGroups = allGroups.filter((g) => !g.isSystem);

  if (isLoading) {
    return (
      <div aria-busy="true" className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-72" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-8 w-40 shrink-0 rounded-lg" />
        </header>
        <StatCardSkeleton count={5} className="grid-cols-2 md:grid-cols-3 lg:grid-cols-5" />
        <div className="flex gap-2 overflow-hidden border-b pb-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-36 shrink-0 rounded-lg" />
          ))}
        </div>
        <TableSkeleton columns={["Access group", "Dashboard", "Coverage", "Candidates", "Agents", "Broadcasts", "Settings"]} />
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="p-4 text-sm text-red-800">
        <p>{error.message}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!permissions?.isAdmin) {
    return (
      <div role="alert" className="p-6 text-sm text-amber-900">
        <AlertCircle className="mr-2 inline h-4 w-4" />
        Admin access is required to view settings.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Role Scoping Notification */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Settings className="h-6 w-6 text-emerald-700" />
              <span>Settings & Access Groups</span>
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Manage Inverted Tree role permissions, custom campaign access groups, Telegram & SMS routing, and NDPA 2023 agent privacy.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          <Button
            disabled
            title="Not available yet"
            size="sm"
            className="text-xs font-medium gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Create Custom Group: Not available yet</span>
          </Button>
        </div>
      </div>

      {/* KPI Metric Summary */}
      <SettingsKPISummary
        totalGroups={allGroups.length}
        customGroupsCount={customGroups.length}
        telegramStatus="Webhook Active (42ms)"
        smsBalance="142k Units"
        phoneMaskingEnabled={true}
        totalAuditEvents={1284}
      />

      {/* Tab Navigation Switcher */}
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-1 overflow-x-auto pb-px">
          {[
            { id: "matrix", label: "Access Matrix & Permissions", icon: Shield, count: allGroups.length },
            { id: "custom", label: "Custom Access Groups", icon: Users, count: customGroups.length },
            { id: "gateways", label: "Channel Gateways (Telegram & SMS)", icon: Radio },
            { id: "security", label: "Privacy, Links & Audit Trail", icon: Lock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-emerald-700 text-emerald-900 bg-emerald-50/50 rounded-t-md"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-emerald-700" : "text-slate-400"}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${
                      isActive ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {tab.count}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content Panes */}
      <div className="pt-1">
        {activeTab === "matrix" && <AccessMatrixTable groups={allGroups} />}

        {activeTab === "custom" && <AccessGroupsManager customGroups={customGroups} />}

        {activeTab === "gateways" && <ChannelGatewaySettings />}

        {activeTab === "security" && <SecurityPrivacySettings />}
      </div>
    </div>
  );
}
