"use client";

import React, { useState } from "react";
import { CandidateData } from "@/lib/types";
import { useApp } from "@/lib/context/app-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CandidateDetailModal } from "./candidate-detail-modal";
import {
  ShieldCheck,
  Eye,
  AlertTriangle,
  Phone,
  FileText,
  User,
} from "lucide-react";

interface CandidatesCardsProps {
  candidates: CandidateData[];
}

export function CandidatesCards({ candidates }: CandidatesCardsProps) {
  const { setPersonaId, activePersona } = useApp();
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenCandidate = (cand: CandidateData) => {
    setSelectedCandidate(cand);
    setIsModalOpen(true);
  };

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

  const getPersonaTarget = (cand: CandidateData) => {
    if (cand.office === "President") return "persona-cand-pres";
    if (cand.office === "House of Reps") return "persona-cand-rep-onitsha";
    if (cand.office === "State Assembly" && cand.id === "cand-ass-04-onitsha-1") return "persona-cand-ass-onitsha-1";
    if (cand.office === "State Assembly" && cand.id === "cand-ass-04-onitsha-2") return "persona-cand-ass-onitsha-2";
    return null;
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {candidates.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-card border rounded-xl">
            No candidates match your filters.
          </div>
        ) : (
          candidates.map((cand) => {
            const personaTarget = getPersonaTarget(cand);
            const isCurrentActive = personaTarget && activePersona.id === personaTarget;

            if (cand.isOffCycle) {
              return (
                <Card
                  key={cand.id}
                  className="border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleOpenCandidate(cand)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={getOfficeBadgeColor(cand.office)}>
                        {cand.office}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                        Off-Cycle State
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Seat: <span className="font-semibold text-foreground">{cand.seat} State</span></div>
                      <div className="font-bold text-sm text-foreground mt-0.5">{cand.name}</div>
                    </div>
                    <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-950/50 p-2.5 rounded border border-amber-200 flex items-start gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{cand.offCycleNote || "No governorship election in Anambra in 2027 (off-cycle state)."}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card
                key={cand.id}
                className={`border-border/80 bg-card shadow-sm hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer ${
                  isCurrentActive ? "ring-2 ring-primary bg-primary/5" : ""
                }`}
                onClick={() => handleOpenCandidate(cand)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={`text-xs font-semibold ${getOfficeBadgeColor(cand.office)}`}>
                      {cand.office}
                    </Badge>
                    <span className="text-[10px] font-mono font-medium text-muted-foreground">
                      {cand.seat}
                    </span>
                  </div>

                  <div>
                    <div className="font-bold text-sm text-foreground">
                      {cand.name}
                    </div>
                    {cand.deputyName && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Running mate: <span className="text-foreground/90 font-medium">{cand.deputyName}</span>
                      </div>
                    )}
                  </div>

                  {/* Channel & Masked Phone */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <div className="flex items-center gap-1 font-mono">
                      <Phone className="w-3 h-3 text-foreground/60" />
                      <span>{cand.phoneMasked}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1 py-0 h-4 ${
                        cand.telegramStatus === "connected"
                          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300"
                          : cand.telegramStatus === "sms_only"
                          ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {cand.telegramStatus === "connected" ? "Telegram" : "SMS Only"}
                    </Badge>
                  </div>

                  {/* Coverage Progress */}
                  <div className="space-y-1.5 pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Official Coverage
                      </span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {cand.coveragePct}%
                      </span>
                    </div>
                    <Progress value={cand.coveragePct} className="h-1.5 bg-emerald-100 dark:bg-emerald-950/40" />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{cand.coveredPUs.toLocaleString()} / {cand.totalPUs.toLocaleString()} PUs</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                        +{cand.extraAgentsCount.toLocaleString()} extra
                      </span>
                    </div>
                  </div>

                  {/* Persona Switcher Button */}
                  {personaTarget && (
                    <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant={isCurrentActive ? "default" : "outline"}
                        size="sm"
                        className="w-full text-xs h-7 gap-1"
                        onClick={() => setPersonaId(personaTarget)}
                      >
                        <Eye className="w-3 h-3" />
                        {isCurrentActive ? "Active Scoped View" : "View As Candidate"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <CandidateDetailModal
        candidate={selectedCandidate}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </div>
  );
}
