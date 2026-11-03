"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/context/app-context";
import { AccessGroup } from "@/lib/types";
import { ACCESS_GROUPS_DATA } from "@/lib/data/settings-data";
import { SettingsKPISummary } from "@/components/settings/settings-kpi-summary";
import { AccessMatrixTable } from "@/components/settings/access-matrix-table";
import { AccessGroupsManager } from "@/components/settings/access-groups-manager";
import { ChannelGatewaySettings } from "@/components/settings/channel-gateway-settings";
import { SecurityPrivacySettings } from "@/components/settings/security-privacy-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Settings,
  Shield,
  Users,
  Radio,
  Lock,
  Plus,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export default function SettingsPage() {
  const { activePersona } = useApp();
  const [activeTab, setActiveTab] = useState<"matrix" | "custom" | "gateways" | "security">("matrix");
  const [allGroups] = useState<AccessGroup[]>(ACCESS_GROUPS_DATA);

  const customGroups = allGroups.filter((g) => !g.isSystem);

  const isPartyOrAdmin =
    activePersona.role === "Party · National" || activePersona.role === "Admin";

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
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-semibold px-2 py-0.5"
            >
              PRD Page 16
            </Badge>
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

      {/* Role Notice for Candidates */}
      {!isPartyOrAdmin && (
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-lg flex items-start gap-3 text-xs text-amber-900">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold">
              Viewing as {activePersona.role} ({activePersona.name}):
            </span>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Per PRD specifications, Settings & Access Groups configuration is managed exclusively by Party National and Admin leadership. You are viewing simulated system permissions and channel gateway health.
            </p>
          </div>
        </div>
      )}

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
