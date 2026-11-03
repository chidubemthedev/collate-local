"use client";

import React, { useState } from "react";
import { PollingUnitData } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateAssignment, useDeleteAssignment } from "@/lib/hooks/use-coverage";
import {
  ShieldCheck,
  AlertCircle,
  MapPin,
  ExternalLink,
  Phone,
  MessageSquare,
  Send,
  UserPlus,
  UserMinus,
  Users,
  CheckCircle2,
  Copy,
  Loader2,
  Trash2,
} from "lucide-react";
import Link from "next/link";

interface PUDetailDrawerProps {
  pu: PollingUnitData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PUDetailDrawer({ pu, open, onOpenChange }: PUDetailDrawerProps) {
  const [isAssigning, setIsAssigning] = useState(false);
  const [personIdInput, setPersonIdInput] = useState("");
  const [ownerType, setOwnerType] = useState<"group" | "candidate">("group");
  const [ownerIdInput, setOwnerIdInput] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);

  const createAssignment = useCreateAssignment();
  const deleteAssignment = useDeleteAssignment();

  if (!pu) return null;

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${pu.latitude},${pu.longitude}`;

  const handleAssign = async () => {
    const ownerId = Number(ownerIdInput);
    if (!pu.id || !personIdInput.trim() || !Number.isSafeInteger(ownerId) || ownerId < 1) {
      setAssignError("Enter a valid Person ID and select a valid owner ID.");
      return;
    }

    setAssignError(null);
    try {
      await createAssignment.mutateAsync({
        pollingUnitId: pu.id,
        personId: personIdInput.trim(),
        agentKind: "official",
        slotNumber: 0,
        ...(ownerType === "group" ? { ownerGroupId: ownerId } : { ownerCandidateId: ownerId }),
      });
      setIsAssigning(false);
      setPersonIdInput("");
      setOwnerIdInput("");
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to assign agent. Verify Person ID.";
      setAssignError(message);
    }
  };

  const handleUnassignOfficial = async () => {
    if (!pu.officialAssignmentId) return;
    try {
      await deleteAssignment.mutateAsync(pu.officialAssignmentId);
      onOpenChange(false);
    } catch (err: unknown) {
      console.error("Failed to unassign official agent:", err);
    }
  };

  const handleUnassignExtra = async (assignmentId?: string) => {
    if (!assignmentId) return;
    try {
      await deleteAssignment.mutateAsync(assignmentId);
      onOpenChange(false);
    } catch (err: unknown) {
      console.error("Failed to unassign extra agent:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header Banner */}
        <div className="p-4 sm:p-5 bg-muted/40 border-b border-border/80">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs font-bold bg-background">
                  {pu.code}
                </Badge>
                {pu.hasOfficialAgent ? (
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs gap-1">
                    <ShieldCheck className="w-3 h-3" /> Official Agent Assigned
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="bg-amber-600 text-white hover:bg-amber-700 text-xs gap-1">
                    <AlertCircle className="w-3 h-3" /> GAP – No Official Agent
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground mt-2">
                {pu.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{pu.location}</span>
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-5">
          {/* Location & GPS Info */}
          <div className="bg-muted/20 border border-border/60 rounded-lg p-3 sm:p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                GPS Verification
              </span>
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
              >
                Open in Map
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono text-muted-foreground pt-1">
              <div>
                <span className="text-[10px] text-muted-foreground/80 block uppercase">Latitude</span>
                <span className="text-foreground font-semibold">{pu.latitude}° N</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground/80 block uppercase">Longitude</span>
                <span className="text-foreground font-semibold">{pu.longitude}° E</span>
              </div>
            </div>
          </div>

          {/* Official Party Agent Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Official Party Agent (Determines 100% Coverage)
              </h4>
              <span className="text-[10px] text-muted-foreground">Slot 1 of 1</span>
            </div>

            {pu.hasOfficialAgent ? (
              <div className="p-3.5 rounded-lg border border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm text-foreground">
                    {pu.officialAgentName}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground font-mono">
                    <Phone className="w-3.5 h-3.5 text-foreground/70" />
                    <span>{pu.officialAgentPhone || "+234 ••• ••• 671"}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Secrecy compliance: NDPA 2023 Masked
                  </div>
                </div>
                {pu.officialAssignmentId && (
                  <div className="pt-1 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 gap-1 border-rose-300 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      onClick={handleUnassignOfficial}
                      disabled={deleteAssignment.isPending}
                    >
                      {deleteAssignment.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      <span>Unassign Official Agent</span>
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-lg border border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
                <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">No Official Agent Assigned</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      This Polling Unit currently has zero official party agents. While extra candidate agents may be present, this PU is marked as a coverage gap.
                    </p>
                  </div>
                </div>

                {isAssigning ? (
                  <div className="space-y-2 pt-2 border-t border-amber-200 dark:border-amber-900/40">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-foreground block">
                        Agent Person ID (UUID):
                      </label>
                      <Input
                        value={personIdInput}
                        onChange={(e) => setPersonIdInput(e.target.value)}
                        placeholder="e.g. f0ebf80e-bee5-4f01-af92-e636bf4879c5"
                        className="text-xs h-8 font-mono"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-foreground block">
                        Assignment owner:
                      </label>
                      <div className="grid grid-cols-[120px_1fr] gap-2">
                        <Select value={ownerType} onValueChange={(value) => {
                          if (value === "group" || value === "candidate") setOwnerType(value);
                        }}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="group">Group</SelectItem>
                            <SelectItem value="candidate">Candidate</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={ownerIdInput}
                          onChange={(e) => setOwnerIdInput(e.target.value)}
                          placeholder={ownerType === "group" ? "Group ID" : "Candidate ID"}
                          className="text-xs h-8 font-mono"
                        />
                      </div>
                    </div>
                    {assignError && (
                      <p className="text-[11px] text-destructive">{assignError}</p>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        className="text-xs h-7 gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                        onClick={handleAssign}
                        disabled={createAssignment.isPending || !personIdInput.trim() || !ownerIdInput.trim()}
                      >
                        {createAssignment.isPending && (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        )}
                        <span>Confirm Assignment</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7"
                        onClick={() => {
                          setIsAssigning(false);
                          setAssignError(null);
                          setOwnerIdInput("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-7 gap-1 mt-1 border-amber-500/50 text-amber-800 dark:text-amber-300"
                    onClick={() => setIsAssigning(true)}
                  >
                    <UserPlus className="w-3 h-3" /> Assign Official Party Agent
                  </Button>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Extra Agents Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                Extra Agents ({pu.extraAgents.length})
              </h4>
              <Badge variant="outline" className="text-[10px]">
                Owner shown
              </Badge>
            </div>

            {pu.extraAgents.length === 0 ? (
              <div className="text-xs text-muted-foreground p-3 rounded-lg border border-dashed text-center">
                No extra agents assigned to this PU.
              </div>
            ) : (
              <div className="space-y-2">
                {pu.extraAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="p-2.5 rounded-lg border border-border/80 bg-card hover:bg-muted/20 transition-colors text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{agent.name}</span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          Role: {agent.role || "Protector"}
                        </Badge>
                        {agent.assignmentId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 px-1.5 text-[10px] text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => handleUnassignExtra(agent.assignmentId)}
                            disabled={deleteAssignment.isPending}
                            title="Unassign this extra agent"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="text-indigo-700 dark:text-indigo-300 font-medium">
                        Sponsor: {agent.owner}
                      </span>
                      <span className="font-mono">{agent.phone || "+234 ••• ••• •••"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions Footer */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
            <Link
              href={`/broadcasts/new?target=${encodeURIComponent(pu.code)}`}
              className="inline-flex items-center justify-center rounded-lg text-xs font-medium h-8 px-4 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm w-full sm:flex-1"
            >
              <Send className="w-3.5 h-3.5" />
              Message Agents at this PU
            </Link>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto text-xs"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
