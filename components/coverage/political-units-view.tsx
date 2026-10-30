"use client";

import React, { useState } from "react";
import { OfficeType, CandidateData } from "@/lib/types";
import { CANDIDATES_DATA } from "@/lib/data/candidates-data";
import { useApp } from "@/lib/context/app-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  Eye,
  Shield,
  AlertTriangle,
  UserCheck,
  Building,
  Layers,
  Phone,
} from "lucide-react";

export function PoliticalUnitsView() {
  const { setPersonaId, activePersona } = useApp();
  const [selectedOffice, setSelectedOffice] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const officeTabs = [
    { id: "all", label: "All Races", count: CANDIDATES_DATA.length },
    { id: "President", label: "Presidency", count: CANDIDATES_DATA.filter((c) => c.office === "President").length },
    { id: "Governor", label: "Governors", count: CANDIDATES_DATA.filter((c) => c.office === "Governor").length },
    { id: "Senate", label: "Senate", count: CANDIDATES_DATA.filter((c) => c.office === "Senate").length },
    { id: "House of Reps", label: "House of Reps", count: CANDIDATES_DATA.filter((c) => c.office === "House of Reps").length },
    { id: "State Assembly", label: "State Assembly", count: CANDIDATES_DATA.filter((c) => c.office === "State Assembly").length },
  ];

  const filteredCandidates = CANDIDATES_DATA.filter((cand) => {
    const matchesOffice = selectedOffice === "all" || cand.office === selectedOffice;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      cand.name.toLowerCase().includes(query) ||
      cand.seat.toLowerCase().includes(query) ||
      (cand.deputyName && cand.deputyName.toLowerCase().includes(query)) ||
      cand.office.toLowerCase().includes(query);

    return matchesOffice && matchesSearch;
  });

  const getOfficeBadgeColor = (office: OfficeType) => {
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

  const getPersonaIdForCandidate = (cand: CandidateData) => {
    if (cand.office === "President") return "persona-cand-pres";
    if (cand.office === "House of Reps") return "persona-cand-rep-onitsha";
    if (cand.office === "State Assembly" && cand.id === "cand-ass-04-onitsha-1") return "persona-cand-ass-onitsha-1";
    if (cand.office === "State Assembly" && cand.id === "cand-ass-04-onitsha-2") return "persona-cand-ass-onitsha-2";
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Search & Office Filter Bar */}
      <div className="bg-card border border-border/80 rounded-xl p-3 sm:p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Office Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {officeTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedOffice(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedOffice === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedOffice === tab.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background text-muted-foreground"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search candidate or seat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-background"
            />
          </div>
        </div>
      </div>

      {/* Candidate Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredCandidates.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-card border rounded-xl">
            No political races match your search or filter.
          </div>
        ) : (
          filteredCandidates.map((cand) => {
            const personaTarget = getPersonaIdForCandidate(cand);
            const isCurrentActivePersona = personaTarget && activePersona.id === personaTarget;

            if (cand.isOffCycle) {
              return (
                <Card
                  key={cand.id}
                  className="border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 shadow-sm flex flex-col justify-between"
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
                      <div className="font-semibold text-base text-foreground mt-0.5">{cand.name}</div>
                    </div>
                    <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-950/50 p-2.5 rounded border border-amber-200 flex items-start gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{cand.offCycleNote || "No governorship election in this state in 2027."}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card
                key={cand.id}
                className={`border-border/80 bg-card shadow-sm hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between ${
                  isCurrentActivePersona ? "ring-2 ring-primary bg-primary/5" : ""
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={`text-xs font-semibold ${getOfficeBadgeColor(cand.office)}`}>
                      {cand.office}
                    </Badge>
                    <span className="text-xs font-mono font-medium text-muted-foreground">
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

                  {/* Masked Phone & Source */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <div className="flex items-center gap-1 font-mono">
                      <Phone className="w-3 h-3 text-foreground/60" />
                      <span>{cand.phoneMasked}</span>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground/80">{cand.source}</span>
                  </div>

                  {/* Coverage Progress */}
                  <div className="space-y-1.5 pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-emerald-600" />
                        Official Party Coverage
                      </span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {cand.coveragePct}%
                      </span>
                    </div>
                    <Progress value={cand.coveragePct} className="h-1.5 bg-emerald-100 dark:bg-emerald-950/40" />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{cand.coveredPUs.toLocaleString()} / {cand.totalPUs.toLocaleString()} PUs</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                        +{cand.extraAgentsCount.toLocaleString()} extra agents
                      </span>
                    </div>
                  </div>

                  {/* Switch View Button */}
                  {personaTarget && (
                    <div className="pt-2">
                      <Button
                        variant={isCurrentActivePersona ? "default" : "outline"}
                        size="sm"
                        className="w-full text-xs h-7.5 gap-1.5"
                        onClick={() => setPersonaId(personaTarget)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {isCurrentActivePersona ? "Active Scoped View" : "View as candidate"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
