"use client";

import React from "react";
import { CandidateData } from "@/lib/types";
import { CANDIDATES_DATA } from "@/lib/data/candidates-data";
import { useApp } from "@/lib/context/app-context";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Eye, Shield, UserCheck, AlertTriangle } from "lucide-react";

interface AtStakeCandidatesProps {
  stateCode: string;
  lgaCode: string;
  wardCode: string;
}

export function AtStakeCandidates({ stateCode, lgaCode, wardCode }: AtStakeCandidatesProps) {
  const { setPersonaId, activePersona } = useApp();

  // Find relevant candidates based on selected hierarchy
  const relevantCandidates: CandidateData[] = [];

  // 1. Presidential Ticket (Always at stake)
  const pres = CANDIDATES_DATA.find((c) => c.office === "President");
  if (pres) relevantCandidates.push(pres);

  // 2. Governorship Ticket
  if (stateCode !== "all") {
    const gov = CANDIDATES_DATA.find(
      (c) => c.office === "Governor" && c.stateCode === stateCode
    );
    if (gov) {
      relevantCandidates.push(gov);
    }
  } else {
    // Show a sample or aggregate governor note
    const sampleGov = CANDIDATES_DATA.find((c) => c.office === "Governor" && c.stateCode === "01");
    // Only show presidential at national unless user drills down, or show summary
  }

  // 3. Senatorial District
  if (stateCode === "04" || lgaCode.startsWith("04-17") || lgaCode.startsWith("04-18")) {
    const sen = CANDIDATES_DATA.find((c) => c.id === "cand-sen-04-north");
    if (sen) relevantCandidates.push(sen);
  } else if (stateCode === "01") {
    const sen = CANDIDATES_DATA.find((c) => c.id === "cand-sen-01-central");
    if (sen) relevantCandidates.push(sen);
  }

  // 4. House of Representatives
  if (lgaCode === "04-17" || lgaCode === "04-18" || (stateCode === "04" && lgaCode === "all")) {
    const rep = CANDIDATES_DATA.find((c) => c.id === "cand-rep-04-onitsha");
    if (rep) relevantCandidates.push(rep);
  }

  // 5. State House of Assembly
  if (lgaCode === "04-17") {
    if (wardCode === "all" || wardCode.endsWith("01") || wardCode.endsWith("02") || wardCode.endsWith("03") || wardCode.endsWith("04") || wardCode.endsWith("05") || wardCode.endsWith("06") || wardCode.endsWith("07")) {
      const ass1 = CANDIDATES_DATA.find((c) => c.id === "cand-ass-04-onitsha-1");
      if (ass1) relevantCandidates.push(ass1);
    }
    if (wardCode === "all" || (!wardCode.endsWith("01") && !wardCode.endsWith("02") && !wardCode.endsWith("03") && !wardCode.endsWith("04") && !wardCode.endsWith("05") && !wardCode.endsWith("06") && !wardCode.endsWith("07"))) {
      const ass2 = CANDIDATES_DATA.find((c) => c.id === "cand-ass-04-onitsha-2");
      if (ass2 && !relevantCandidates.some(c => c.id === ass2.id)) relevantCandidates.push(ass2);
    }
  }

  const getOfficeBadgeColor = (office: string) => {
    switch (office) {
      case "President":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "Governor":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "Senate":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "House of Reps":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "State Assembly":
        return "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getPersonaIdForCandidate = (cand: CandidateData) => {
    if (cand.office === "President") return "persona-cand-pres";
    if (cand.office === "House of Reps") return "persona-cand-rep-onitsha";
    if (cand.office === "State Assembly" && cand.id === "cand-ass-04-onitsha-1") return "persona-cand-ass-onitsha-1";
    if (cand.office === "State Assembly" && cand.id === "cand-ass-04-onitsha-2") return "persona-cand-ass-onitsha-2";
    return null;
  };

  if (relevantCandidates.length === 1) {
    const cand = relevantCandidates[0];
    const personaTarget = getPersonaIdForCandidate(cand);
    const isCurrentActivePersona = personaTarget && activePersona.id === personaTarget;

    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-primary" />
              At Stake Here
            </h3>
            <Badge variant="secondary" className="text-xs px-2 py-0.5 font-normal">
              1 race at this level
            </Badge>
          </div>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Official coverage rule: 1 official agent = covered
          </span>
        </div>

        <div
          className={`border border-border/60 bg-card rounded-xl p-4 sm:p-5 shadow-none transition-all ${
            isCurrentActivePersona ? "ring-2 ring-primary bg-primary/5" : ""
          }`}
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
            {/* Candidate Identity */}
            <div className="md:col-span-5 space-y-2.5">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-xs font-medium ${getOfficeBadgeColor(cand.office)}`}>
                  {cand.office}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">
                  {cand.seat}
                </span>
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                  {cand.name}
                </h4>
                {cand.deputyName && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Running mate: <span className="text-foreground/90 font-medium">{cand.deputyName}</span>
                  </p>
                )}
              </div>
              {personaTarget && (
                <div className="pt-1">
                  <Button
                    variant={isCurrentActivePersona ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-7.5 gap-1.5 px-3"
                    onClick={() => setPersonaId(personaTarget)}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {isCurrentActivePersona ? "Active Scoped View" : "View as candidate"}
                  </Button>
                </div>
              )}
            </div>

            {/* Candidate Coverage & Live Progress */}
            <div className="md:col-span-7 md:border-l md:border-border/60 md:pl-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Official Agent Coverage
                </span>
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                  {cand.coveragePct}%
                </span>
              </div>

              <Progress value={cand.coveragePct} className="h-2 bg-emerald-100 dark:bg-emerald-950/40" />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
                <div>
                  <div className="text-[11px] text-muted-foreground">Polling Units Covered</div>
                  <div className="font-semibold text-foreground mt-0.5">
                    {cand.coveredPUs.toLocaleString()} / {cand.totalPUs.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Extra Protectors</div>
                  <div className="font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    +{cand.extraAgentsCount.toLocaleString()} tagged
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <div className="text-[11px] text-muted-foreground">National Target</div>
                  <div className="font-semibold text-foreground mt-0.5">
                    100% (37 States + FCT)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-primary" />
            At Stake Here
          </h3>
          <Badge variant="secondary" className="text-xs px-2 py-0.5 font-normal">
            {relevantCandidates.length} race{relevantCandidates.length > 1 ? "s" : ""} at this level
          </Badge>
        </div>
        <span className="text-[11px] text-muted-foreground hidden sm:inline">
          Official coverage rule: 1 official agent = covered
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {relevantCandidates.map((cand) => {
          const personaTarget = getPersonaIdForCandidate(cand);
          const isCurrentActivePersona = personaTarget && activePersona.id === personaTarget;

          if (cand.isOffCycle) {
            return (
              <div
                key={cand.id}
                className="border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 rounded-xl p-3.5 space-y-2.5 shadow-none flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={getOfficeBadgeColor(cand.office)}>
                    {cand.office}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                    Off-Cycle State
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Seat: <span className="font-semibold text-foreground">{cand.seat} State</span></div>
                  <div className="font-semibold text-sm text-foreground mt-0.5">{cand.name}</div>
                </div>
                <div className="text-[11px] text-amber-800 dark:text-amber-300/90 leading-tight bg-amber-100/60 dark:bg-amber-950/50 p-2 rounded border border-amber-200 dark:border-amber-900/50 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>{cand.offCycleNote || "No governorship election in this state in 2027."}</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={cand.id}
              className={`border border-border/60 bg-card rounded-xl p-3.5 shadow-none hover:border-primary/40 transition-colors flex flex-col justify-between space-y-2.5 ${
                isCurrentActivePersona ? "ring-2 ring-primary bg-primary/5" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={`text-[11px] font-medium ${getOfficeBadgeColor(cand.office)}`}>
                  {cand.office}
                </Badge>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {cand.seat}
                </span>
              </div>

              <div>
                <div className="font-semibold text-sm text-foreground leading-tight">
                  {cand.name}
                </div>
                {cand.deputyName && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Running mate: <span className="text-foreground/90 font-medium">{cand.deputyName}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 pt-1 border-t border-border/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Shield className="w-3 h-3 text-emerald-600" />
                    Official coverage
                  </span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    {cand.coveragePct}%
                  </span>
                </div>
                <Progress value={cand.coveragePct} className="h-1.5 bg-emerald-100 dark:bg-emerald-950/40" />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{cand.coveredPUs.toLocaleString()} / {cand.totalPUs.toLocaleString()} PUs</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                    +{cand.extraAgentsCount.toLocaleString()} extra agents
                  </span>
                </div>
              </div>

              {personaTarget && (
                <div className="pt-1">
                  <Button
                    variant={isCurrentActivePersona ? "default" : "outline"}
                    size="sm"
                    className="w-full text-xs h-7 gap-1"
                    onClick={() => setPersonaId(personaTarget)}
                  >
                    <Eye className="w-3 h-3" />
                    {isCurrentActivePersona ? "Active Scoped View" : "View as candidate"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
