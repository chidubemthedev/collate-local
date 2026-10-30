"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATES_DATA, LGAS_DATA, WARDS_DATA } from "@/lib/data/inec-data";
import {
  Users,
  MapPin,
  ShieldCheck,
  UserCheck,
  Building2,
  Sparkles,
  Info,
  Radio,
  Lock,
} from "lucide-react";
import { Persona } from "@/lib/types";

export interface AudienceConfig {
  includeCandidates: boolean;
  includeOfficialAgents: boolean;
  includeExtraAgents: boolean;
  includeCoordinators: boolean;
  scopeType: "national" | "state" | "lga" | "ward";
  stateCode: string;
  lgaCode: string;
  wardCode: string;
}

interface StepAudienceProps {
  audience: AudienceConfig;
  onChange: (updated: AudienceConfig) => void;
  activePersona: Persona;
  computedCounts: {
    candidates: number;
    officialAgents: number;
    extraAgents: number;
    total: number;
    telegramReady: number;
    smsFallback: number;
  };
}

export function StepAudience({
  audience,
  onChange,
  activePersona,
  computedCounts,
}: StepAudienceProps) {
  const isCandidatePersona = activePersona.role.startsWith("Candidate");

  // LGA options for selected state
  const availableLgas = LGAS_DATA.filter(
    (l) => audience.stateCode === "all" || l.stateCode === audience.stateCode
  );

  // Ward options for selected LGA
  const availableWards = WARDS_DATA.filter(
    (w) => audience.lgaCode === "all" || w.lgaCode === audience.lgaCode
  );

  return (
    <div className="space-y-6">
      {/* 1. Recipient Role Types */}
      <Card className="border-border/80 shadow-xs bg-card">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span>Recipient Target Roles</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Select which roster roles should receive this broadcast alert.
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              Step 1 of 3
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Candidates */}
            <div
              onClick={() =>
                onChange({
                  ...audience,
                  includeCandidates: !audience.includeCandidates,
                })
              }
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                audience.includeCandidates
                  ? "bg-primary/5 border-primary/40 shadow-xs"
                  : "bg-muted/20 border-border hover:bg-muted/40"
              }`}
            >
              <Checkbox
                checked={audience.includeCandidates}
                onCheckedChange={(checked) =>
                  onChange({
                    ...audience,
                    includeCandidates: !!checked,
                  })
                }
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span>NDC Candidates</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-background">
                    {computedCounts.candidates} matching
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Presidency, Governors, Senators, House of Reps, and State Assembly candidates.
                </p>
              </div>
            </div>

            {/* Official Party Agents */}
            <div
              onClick={() =>
                onChange({
                  ...audience,
                  includeOfficialAgents: !audience.includeOfficialAgents,
                })
              }
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                audience.includeOfficialAgents
                  ? "bg-emerald-500/10 border-emerald-500/40 shadow-xs dark:bg-emerald-950/20"
                  : "bg-muted/20 border-border hover:bg-muted/40"
              }`}
            >
              <Checkbox
                checked={audience.includeOfficialAgents}
                onCheckedChange={(checked) =>
                  onChange({
                    ...audience,
                    includeOfficialAgents: !!checked,
                  })
                }
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Official Party Agents</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-background">
                    {computedCounts.officialAgents} PUs
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Primary certified agents holding official INEC badges (1 per Polling Unit).
                </p>
              </div>
            </div>

            {/* Extra Candidate-sponsored Agents */}
            <div
              onClick={() =>
                onChange({
                  ...audience,
                  includeExtraAgents: !audience.includeExtraAgents,
                })
              }
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                audience.includeExtraAgents
                  ? "bg-indigo-500/10 border-indigo-500/40 shadow-xs dark:bg-indigo-950/20"
                  : "bg-muted/20 border-border hover:bg-muted/40"
              }`}
            >
              <Checkbox
                checked={audience.includeExtraAgents}
                onCheckedChange={(checked) =>
                  onChange({
                    ...audience,
                    includeExtraAgents: !!checked,
                  })
                }
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Candidate Extra Agents</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-background">
                    {computedCounts.extraAgents} agents
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Extra Protectors, Mobilisers, and Snappers sponsored by candidate tickets.
                </p>
              </div>
            </div>

            {/* Ward & LGA Coordinators */}
            <div
              onClick={() =>
                onChange({
                  ...audience,
                  includeCoordinators: !audience.includeCoordinators,
                })
              }
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                audience.includeCoordinators
                  ? "bg-amber-500/10 border-amber-500/40 shadow-xs dark:bg-amber-950/20"
                  : "bg-muted/20 border-border hover:bg-muted/40"
              }`}
            >
              <Checkbox
                checked={audience.includeCoordinators}
                onCheckedChange={(checked) =>
                  onChange({
                    ...audience,
                    includeCoordinators: !!checked,
                  })
                }
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Ward & LGA Coordinators</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-background">
                    Field Command
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Field supervisors responsible for local polling unit logistics and escalations.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Geographic Target Scope */}
      <Card className="border-border/80 shadow-xs bg-card">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <span>Target Geographic Scope</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Define the boundary level for this broadcast dispatch.
            </p>
          </div>

          {/* Persona constraint alert if candidate */}
          {isCandidatePersona && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                Your candidate persona is scoped to <strong>{activePersona.label}</strong>. Broadcasts
                will automatically filter within your constituency tree.
              </span>
            </div>
          )}

          {/* Scope Type Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {!isCandidatePersona && (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...audience,
                    scopeType: "national",
                    stateCode: "all",
                    lgaCode: "all",
                    wardCode: "all",
                  })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  audience.scopeType === "national"
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Nationwide (All 37 States)
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                onChange({
                  ...audience,
                  scopeType: "state",
                  stateCode: audience.stateCode === "all" ? "04" : audience.stateCode,
                  lgaCode: "all",
                  wardCode: "all",
                })
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                audience.scopeType === "state"
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Statewide Level
            </button>

            <button
              type="button"
              onClick={() =>
                onChange({
                  ...audience,
                  scopeType: "lga",
                  stateCode: audience.stateCode === "all" ? "04" : audience.stateCode,
                  lgaCode: audience.lgaCode === "all" ? "04-17" : audience.lgaCode,
                  wardCode: "all",
                })
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                audience.scopeType === "lga"
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              LGA / Constituency Level
            </button>

            <button
              type="button"
              onClick={() =>
                onChange({
                  ...audience,
                  scopeType: "ward",
                  stateCode: audience.stateCode === "all" ? "04" : audience.stateCode,
                  lgaCode: audience.lgaCode === "all" ? "04-17" : audience.lgaCode,
                  wardCode: audience.wardCode === "all" ? "04-17-03" : audience.wardCode,
                })
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                audience.scopeType === "ward"
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Ward / Polling Unit Level
            </button>
          </div>

          {/* Cascading Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {/* State Selector */}
            {audience.scopeType !== "national" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">State</Label>
                <Select
                  value={audience.stateCode}
                  onValueChange={(val) =>
                    val &&
                    onChange({
                      ...audience,
                      stateCode: val,
                      lgaCode: "all",
                      wardCode: "all",
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Select State" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {STATES_DATA.map((st) => (
                      <SelectItem key={st.code} value={st.code}>
                        {st.code} · {st.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* LGA Selector */}
            {(audience.scopeType === "lga" || audience.scopeType === "ward") && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Local Government Area (LGA)</Label>
                <Select
                  value={audience.lgaCode}
                  onValueChange={(val) =>
                    val &&
                    onChange({
                      ...audience,
                      lgaCode: val,
                      wardCode: "all",
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Select LGA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All LGAs</SelectItem>
                    {availableLgas.map((lga) => (
                      <SelectItem key={lga.code} value={lga.code}>
                        {lga.code} · {lga.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Ward Selector */}
            {audience.scopeType === "ward" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Ward</Label>
                <Select
                  value={audience.wardCode}
                  onValueChange={(val) =>
                    val &&
                    onChange({
                      ...audience,
                      wardCode: val,
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Select Ward" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Wards</SelectItem>
                    {availableWards.map((w) => (
                      <SelectItem key={w.code} value={w.code}>
                        {w.code} · {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. Live Target Audience Reach Card */}
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-primary animate-pulse" />
            Computed Audience Reach
          </span>
          <span className="text-lg font-mono font-extrabold text-primary">
            {computedCounts.total.toLocaleString()} Recipients
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-background border border-border">
            <div className="text-[11px] text-muted-foreground">Candidates</div>
            <div className="text-sm font-bold font-mono text-foreground mt-0.5">
              {computedCounts.candidates.toLocaleString()}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-background border border-border">
            <div className="text-[11px] text-muted-foreground">Official Agents</div>
            <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              {computedCounts.officialAgents.toLocaleString()}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-background border border-border">
            <div className="text-[11px] text-muted-foreground">Extra Agents</div>
            <div className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
              {computedCounts.extraAgents.toLocaleString()}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-background border border-border">
            <div className="text-[11px] text-muted-foreground">Telegram Ready</div>
            <div className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
              {computedCounts.telegramReady.toLocaleString()} ({computedCounts.smsFallback} SMS fallback)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
