"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  Radio,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import {
  useGeographyStates,
  useGeographyLgas,
  useGeographyWards,
} from "@/lib/hooks/use-geography";
import type { AudiencePreview } from "@/types/api";

export interface AudienceConfig {
  stateId: number | null;
  lgaId: number | null;
  wardId: number | null;
  agentKind: "all" | "official" | "extra";
}

interface StepAudienceProps {
  audience: AudienceConfig;
  onChange: (updated: AudienceConfig) => void;
  preview: AudiencePreview | null;
  previewLoading: boolean;
  previewError: string | null;
  onRetryPreview: () => void;
}

export function StepAudience({
  audience,
  onChange,
  preview,
  previewLoading,
  previewError,
  onRetryPreview,
}: StepAudienceProps) {
  const statesQuery = useGeographyStates();
  const lgasQuery = useGeographyLgas(audience.stateId);
  const wardsQuery = useGeographyWards(audience.lgaId);

  const totalRecipients = preview
    ? audience.agentKind === "official"
      ? preview.officialCount
      : audience.agentKind === "extra"
        ? preview.extraCount
        : preview.officialCount + preview.extraCount
    : null;

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card shadow-xs">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Users className="h-4 w-4 text-primary" />
                <span>Recipient Target Roles</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Choose which supported agent roles receive this broadcast.
              </p>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              Step 1 of 3
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              <div className="flex-1 space-y-0.5">
                <Label htmlFor="agent-kind" className="text-xs font-bold">
                  Agent type
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Filter by official or extra assignment, or include both.
                </p>
              </div>
              <Select
                value={audience.agentKind}
                onValueChange={(value) => {
                  if (value === "all" || value === "official" || value === "extra") {
                    onChange({ ...audience, agentKind: value });
                  }
                }}
              >
                <SelectTrigger id="agent-kind" className="h-9 w-36 bg-background text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All agents</SelectItem>
                  <SelectItem value="official">Official</SelectItem>
                  <SelectItem value="extra">Extra</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3.5 opacity-70">
              <Checkbox checked={false} disabled aria-label="Candidates not available yet" />
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <span>Candidates</span>
                  <Badge variant="outline" className="bg-background px-1 py-0 text-[10px]">
                    Not available yet
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Candidate recipients are not supported by the broadcast API.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3.5 opacity-70">
              <Checkbox checked={false} disabled aria-label="Coordinators not available yet" />
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Coordinators</span>
                  <Badge variant="outline" className="bg-background px-1 py-0 text-[10px]">
                    Not available yet
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Coordinator recipients are not supported by the broadcast API.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card shadow-xs">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="space-y-0.5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              <span>Target Geographic Scope</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Select an area to filter recipients. Leave selectors at “All” for a wider scope.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="broadcast-state" className="text-xs font-semibold">
                State
              </Label>
              <Select
                value={audience.stateId === null ? "all" : String(audience.stateId)}
                onValueChange={(value) => {
                  if (value === "all") {
                    onChange({ ...audience, stateId: null, lgaId: null, wardId: null });
                  } else if (value) {
                    onChange({
                      ...audience,
                      stateId: Number(value),
                      lgaId: null,
                      wardId: null,
                    });
                  }
                }}
                disabled={statesQuery.isLoading || statesQuery.isError}
              >
                <SelectTrigger id="broadcast-state" className="h-9 bg-background text-xs">
                  <SelectValue placeholder="All states" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All states</SelectItem>
                  {statesQuery.data?.map((state) => (
                    <SelectItem key={state.id} value={String(state.id)}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {statesQuery.isError && (
                <div role="alert" className="text-[11px] text-destructive">
                  {statesQuery.error.message}
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 pl-1 text-[11px]"
                    onClick={() => void statesQuery.refetch()}
                  >
                    Retry
                  </Button>
                </div>
              )}
              {statesQuery.data?.length === 0 && !statesQuery.isLoading && (
                <p className="text-[11px] text-muted-foreground">No available states.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="broadcast-lga" className="text-xs font-semibold">
                Local Government Area
              </Label>
              <Select
                value={audience.lgaId === null ? "all" : String(audience.lgaId)}
                onValueChange={(value) => {
                  if (value === "all") {
                    onChange({ ...audience, lgaId: null, wardId: null });
                  } else if (value) {
                    onChange({ ...audience, lgaId: Number(value), wardId: null });
                  }
                }}
                disabled={!audience.stateId || lgasQuery.isLoading || lgasQuery.isError}
              >
                <SelectTrigger id="broadcast-lga" className="h-9 bg-background text-xs">
                  <SelectValue placeholder="All LGAs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All LGAs</SelectItem>
                  {lgasQuery.data?.map((lga) => (
                    <SelectItem key={lga.id} value={String(lga.id)}>
                      {lga.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lgasQuery.isError && (
                <div role="alert" className="text-[11px] text-destructive">
                  {lgasQuery.error.message}
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 pl-1 text-[11px]"
                    onClick={() => void lgasQuery.refetch()}
                  >
                    Retry
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="broadcast-ward" className="text-xs font-semibold">
                Ward
              </Label>
              <Select
                value={audience.wardId === null ? "all" : String(audience.wardId)}
                onValueChange={(value) => {
                  if (value === "all") {
                    onChange({ ...audience, wardId: null });
                  } else if (value) {
                    onChange({ ...audience, wardId: Number(value) });
                  }
                }}
                disabled={!audience.lgaId || wardsQuery.isLoading || wardsQuery.isError}
              >
                <SelectTrigger id="broadcast-ward" className="h-9 bg-background text-xs">
                  <SelectValue placeholder="All wards" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All wards</SelectItem>
                  {wardsQuery.data?.map((ward) => (
                    <SelectItem key={ward.id} value={String(ward.id)}>
                      {ward.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {wardsQuery.isError && (
                <div role="alert" className="text-[11px] text-destructive">
                  {wardsQuery.error.message}
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 pl-1 text-[11px]"
                    onClick={() => void wardsQuery.refetch()}
                  >
                    Retry
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Radio className="h-3.5 w-3.5 text-primary" />
            Audience preview
          </span>
          <span className="text-lg font-mono font-extrabold text-primary">
            {previewLoading ? "Loading…" : totalRecipients?.toLocaleString() ?? "—"} recipients
          </span>
        </div>

        {previewError ? (
          <div role="alert" className="flex items-center justify-between gap-2 text-xs text-destructive">
            <span>{previewError}</span>
            <Button type="button" variant="outline" size="sm" onClick={onRetryPreview}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-border bg-background p-2.5">
              <div className="text-[11px] text-muted-foreground">Official agents</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-emerald-600">
                {previewLoading ? "…" : preview?.officialCount.toLocaleString() ?? "—"}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-2.5">
              <div className="text-[11px] text-muted-foreground">Extra agents</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-indigo-600">
                {previewLoading ? "…" : preview?.extraCount.toLocaleString() ?? "—"}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
