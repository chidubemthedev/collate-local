"use client";

import React from "react";
import { CandidateData } from "@/lib/types";
import { useApp } from "@/lib/context/app-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ShieldCheck,
  AlertTriangle,
  User,
  Users,
  Phone,
  MessageSquare,
  Send,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileText,
  MapPin,
} from "lucide-react";
import Link from "next/link";

interface CandidateDetailModalProps {
  candidate: CandidateData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CandidateDetailModal({
  candidate,
  open,
  onOpenChange,
}: CandidateDetailModalProps) {
  const { setPersonaId, activePersona } = useApp();

  if (!candidate) return null;

  const getOfficeBadgeColor = (office: string) => {
    switch (office) {
      case "President":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200";
      case "Governor":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200";
      case "Senate":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200";
      case "House of Reps":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200";
      case "State Assembly":
        return "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getPersonaTarget = () => {
    if (candidate.office === "President") return "persona-cand-pres";
    if (candidate.office === "House of Reps") return "persona-cand-rep-onitsha";
    if (candidate.office === "State Assembly" && candidate.id === "cand-ass-04-onitsha-1") return "persona-cand-ass-onitsha-1";
    if (candidate.office === "State Assembly" && candidate.id === "cand-ass-04-onitsha-2") return "persona-cand-ass-onitsha-2";
    return null;
  };

  const personaTarget = getPersonaTarget();
  const isCurrentActive = personaTarget && activePersona.id === personaTarget;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-muted/40 border-b border-border/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getOfficeBadgeColor(candidate.office)}>
                {candidate.office}
              </Badge>
              <Badge variant="outline" className="font-mono text-[10px]">
                {candidate.seat}
              </Badge>
            </div>
            {candidate.isOffCycle && (
              <Badge variant="destructive" className="bg-amber-600 text-white text-[10px]">
                Off-Cycle
              </Badge>
            )}
          </div>

          <DialogTitle className="text-base sm:text-lg font-bold text-foreground mt-2.5">
            {candidate.name}
          </DialogTitle>
          {candidate.deputyName && (
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Running mate: <span className="text-foreground font-medium">{candidate.deputyName}</span>
            </DialogDescription>
          )}
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {candidate.isOffCycle ? (
            <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Off-Cycle Election Seat</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {candidate.offCycleNote || "No election scheduled for this seat in 2027 general election cycle."}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Coverage KPI Box */}
              <div className="p-3.5 rounded-lg border border-border/80 bg-card space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Official Party Agent Coverage
                  </span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                    {candidate.coveragePct}%
                  </span>
                </div>
                <Progress value={candidate.coveragePct} className="h-2 bg-emerald-100 dark:bg-emerald-950/40" />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span>{candidate.coveredPUs.toLocaleString()} Covered PUs</span>
                  <span>{(candidate.totalPUs - candidate.coveredPUs).toLocaleString()} Gaps</span>
                  <span>{candidate.totalPUs.toLocaleString()} Total PUs</span>
                </div>
              </div>

              {/* Extra Agents & Secrecy */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-lg border border-border/70 bg-muted/20">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Candidate Extra Agents
                  </span>
                  <div className="text-base font-bold text-foreground mt-0.5">
                    {candidate.extraAgentsCount.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    Tagged protectors & mobilisers
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-border/70 bg-muted/20">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Channel Status
                  </span>
                  <div className="mt-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        candidate.telegramStatus === "connected"
                          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300"
                          : candidate.telegramStatus === "sms_only"
                          ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {candidate.telegramStatus === "connected"
                        ? "Telegram Connected"
                        : candidate.telegramStatus === "sms_only"
                        ? "SMS Fallback Only"
                        : "Number Not Matched"}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono block mt-1">
                    {candidate.phoneMasked}
                  </span>
                </div>
              </div>

              {/* Verification Reference */}
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  INEC Validation Source
                </span>
                <span className="font-mono font-medium text-foreground">{candidate.source}</span>
              </div>
            </>
          )}

          <Separator />

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            {personaTarget && (
              <Button
                variant={isCurrentActive ? "default" : "outline"}
                className="w-full text-xs h-8 gap-1.5"
                onClick={() => {
                  setPersonaId(personaTarget);
                  onOpenChange(false);
                }}
              >
                <Eye className="w-3.5 h-3.5" />
                {isCurrentActive ? "Active Scoped View" : "View As This Candidate"}
              </Button>
            )}

            <div className="flex items-center gap-2">
              <Link
                href={`/broadcasts/new?target=${encodeURIComponent(candidate.name)}`}
                className="inline-flex items-center justify-center rounded-lg text-xs font-medium h-8 px-3 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm flex-1"
                onClick={() => onOpenChange(false)}
              >
                <Send className="w-3.5 h-3.5" />
                Send Broadcast to Candidate
              </Link>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="text-xs h-8"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
