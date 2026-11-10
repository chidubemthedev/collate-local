"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AssignAgentForm } from "./assign-agent-form";
import { useDeleteAssignment } from "@/lib/hooks/use-coverage";
import { READ_ONLY_TITLE, useReadOnly } from "@/lib/hooks/use-auth";
import {
  ShieldCheck,
  AlertCircle,
  MapPin,
  ExternalLink,
  Send,
  Users,
  UserCheck,
  Building,
  Loader2,
  Trash2,
} from "lucide-react";
import Link from "next/link";

export interface UnifiedAgentRecord {
  id: string;
  assignmentId?: string;
  personId?: string;
  puId?: number;
  name: string;
  type: "official" | "extra" | "gap";
  sponsor: string;
  role: string;
  phoneMasked: string;
  telegramStatus?: "connected" | "sms_only" | "not_matched";
  puCode: string;
  puName: string;
  puLocation: string;
  latitude?: number | null;
  longitude?: number | null;
  hasGPS?: boolean;
  wardCode?: string;
  wardName?: string;
  lgaCode?: string;
  lgaName?: string;
  stateCode?: string;
  stateName?: string;
  coAgents?: Array<{ name: string; sponsor: string; role: string; type: string }>;
}

interface AgentDetailModalProps {
  agent: UnifiedAgentRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssignOfficial?: (puCode: string) => void;
  /** Open with the "Add extra agent" form already showing (the table's Add extra button). */
  startAddingExtra?: boolean;
}

export function AgentDetailModal({
  agent,
  open,
  onOpenChange,
  onAssignOfficial,
  startAddingExtra = false,
}: AgentDetailModalProps) {
  const deleteAssignment = useDeleteAssignment();
  const readOnly = useReadOnly();

  const [isAssigning, setIsAssigning] = useState(false);
  const [isAddingExtra, setIsAddingExtra] = useState(startAddingExtra);

  if (!agent) return null;

  const hasCoords = typeof agent.latitude === "number" && typeof agent.longitude === "number";
  const mapUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${agent.latitude},${agent.longitude}`
    : "";

  const isGap = agent.type === "gap";
  const isOfficial = agent.type === "official";

  const puId = agent.puId;

  const handleLiveUnassign = async () => {
    if (!agent.assignmentId) return;
    try {
      await deleteAssignment.mutateAsync(agent.assignmentId);
      onOpenChange(false);
    } catch (err: unknown) {
      console.error("Failed to unassign agent:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-muted/40 border-b border-border/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOfficial && (
                <Badge className="bg-emerald-600 text-white text-xs gap-1">
                  <ShieldCheck className="w-3 h-3" /> Official Party Agent
                </Badge>
              )}
              {agent.type === "extra" && (
                <Badge variant="outline" className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 text-xs gap-1">
                  <Users className="w-3 h-3" /> Candidate Extra Agent
                </Badge>
              )}
              {isGap && (
                <Badge variant="destructive" className="bg-amber-600 text-white text-xs gap-1">
                  <AlertCircle className="w-3 h-3" /> Coverage Gap (No Official Agent)
                </Badge>
              )}
              <span className="font-mono text-xs text-muted-foreground">{agent.puCode}</span>
            </div>
          </div>

          <DialogTitle className="text-base sm:text-lg font-bold text-foreground mt-2.5">
            {isGap ? "Unassigned Polling Unit" : agent.name}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            {isGap
              ? "This polling unit has no official party agent registered."
              : `Sponsor / Owner: ${agent.sponsor}`}
          </DialogDescription>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Polling Unit Box */}
          <div className="p-3.5 rounded-lg border border-border/80 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-primary" />
                {agent.puName}
              </span>
              {hasCoords && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  Map
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0 mt-0.5" />
              <span>{agent.puLocation}</span>
            </p>
            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-1 border-t border-border/50">
              <span>Code: {agent.puCode}</span>
              {hasCoords ? (
                <span>
                  GPS: {(agent.latitude as number).toFixed(4)}° N, {(agent.longitude as number).toFixed(4)}° E
                </span>
              ) : agent.hasGPS === false ? (
                <span>GPS: Not Available</span>
              ) : null}
            </div>
          </div>

          {!isGap && (
            <>
              {/* Role & Channel Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-lg border border-border/70 bg-card space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Type
                  </span>
                  <div className="font-semibold text-sm text-foreground flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-primary" />
                    <span>{isOfficial ? "Official" : "Extra"}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground block">
                    {isOfficial
                      ? "One per unit; this is what makes the unit covered"
                      : "Tagged by owner; never changes coverage"}
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-border/70 bg-card space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Channel & Contact
                  </span>
                  <div>
                    {agent.telegramStatus && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          agent.telegramStatus === "connected"
                            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300"
                            : agent.telegramStatus === "sms_only"
                            ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {agent.telegramStatus === "connected"
                          ? "Telegram Connected"
                          : agent.telegramStatus === "sms_only"
                          ? "SMS Fallback Only"
                          : "Number Not Matched"}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs font-mono font-medium text-foreground block pt-0.5">
                    {agent.phoneMasked}
                  </span>
                  <span className="text-[9px] text-muted-foreground block">
                    Masked per NDPA 2023 agent privacy
                  </span>
                </div>
              </div>

              {/* Co-Agents at this PU */}
              {agent.coAgents && agent.coAgents.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-muted-foreground flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      Team at this Polling Unit ({agent.coAgents.length + 1} total agents)
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {agent.coAgents.map((co, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded border border-border/60 bg-muted/10 text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-medium text-foreground">{co.name}</span>
                          <span className="text-[10px] text-muted-foreground ml-2">({co.sponsor})</span>
                        </div>
                        <Badge variant="secondary" className="text-[9px]">
                          {co.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extra agents: only once the unit has its official agent. */}
              {isOfficial && puId !== undefined && (
                <div className="p-3.5 rounded-lg border border-border/80 bg-muted/20 space-y-2">
                  {!isAddingExtra ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        Extra agents support the official agent, they never change coverage.
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7.5 shrink-0 text-xs gap-1"
                        onClick={() => setIsAddingExtra(true)}
                        disabled={readOnly}
                        title={readOnly ? READ_ONLY_TITLE : undefined}
                      >
                        <Users className="w-3.5 h-3.5" />
                        Add extra agent
                      </Button>
                    </div>
                  ) : (
                    <>
                      <label className="text-xs font-semibold text-foreground block">Add Extra Agent</label>
                      <AssignAgentForm
                        pollingUnitId={puId}
                        agentKind="extra"
                        onAssigned={() => {
                          setIsAddingExtra(false);
                          onOpenChange(false);
                        }}
                        onCancel={() => setIsAddingExtra(false)}
                      />
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {isGap && (
            <div className="p-3.5 rounded-lg border border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 space-y-3">
              <div className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Immediate Assignment Required</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Without an official party agent, election collation sheets (EC8A) cannot be signed or certified at this unit.
                  </p>
                </div>
              </div>

              {!isAssigning ? (
                <Button
                  size="sm"
                  className="w-full text-xs h-8 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => setIsAssigning(true)}
                  disabled={readOnly || puId === undefined}
                  title={readOnly ? READ_ONLY_TITLE : undefined}
                >
                  Assign Official Party Agent Now
                </Button>
              ) : puId !== undefined ? (
                <div className="space-y-2 pt-1 border-t border-amber-200 dark:border-amber-800">
                  <label className="text-xs font-semibold text-foreground block">Assign Official Agent</label>
                  <AssignAgentForm
                    pollingUnitId={puId}
                    agentKind="official"
                    onAssigned={() => {
                      setIsAssigning(false);
                      onAssignOfficial?.(agent.puCode);
                      onOpenChange(false);
                    }}
                    onCancel={() => setIsAssigning(false)}
                  />
                </div>
              ) : null}
            </div>
          )}

          <Separator />

          {/* Action Footer */}
          <div className="flex items-center gap-2 pt-1">
            {!isGap && agent.personId && (
              <Link
                href={`/broadcasts/new?personId=${encodeURIComponent(agent.personId)}`}
                className="inline-flex items-center justify-center rounded-lg text-xs font-medium h-8 px-3 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex-1"
                onClick={() => onOpenChange(false)}
              >
                <Send className="w-3.5 h-3.5" />
                Message this Agent
              </Link>
            )}

            {!isGap && agent.assignmentId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLiveUnassign}
                disabled={deleteAssignment.isPending || readOnly}
                title={readOnly ? READ_ONLY_TITLE : undefined}
                className="text-xs h-8 text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
              >
                {deleteAssignment.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Unassign
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs h-8"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
