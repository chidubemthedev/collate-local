"use client";

import React, { useState, useMemo } from "react";
import { POLLING_UNITS_DATA, WARDS_DATA, LGAS_DATA, STATES_DATA, NIGERIA_SUMMARY } from "@/lib/data/inec-data";
import { useApp } from "@/lib/context/app-context";
import { AgentsKPISummary } from "@/components/agents/agents-kpi-summary";
import { AgentsFilters } from "@/components/agents/agents-filters";
import { AgentsTable } from "@/components/agents/agents-table";
import { UnifiedAgentRecord } from "@/components/agents/agent-detail-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  ShieldCheck,
  Send,
  Download,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

export default function AgentsPage() {
  const { activePersona } = useApp();

  const [selectedTypeTab, setSelectedTypeTab] = useState<"all" | "official" | "extra" | "gaps">("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedLga, setSelectedLga] = useState<string>("all");
  const [selectedWard, setSelectedWard] = useState<string>("all");
  const [selectedSponsor, setSelectedSponsor] = useState<string>("all");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Build unified agent records list
  const [puList, setPuList] = useState(POLLING_UNITS_DATA);

  // Generate full unified agent records from polling units
  const allAgentRecords = useMemo<UnifiedAgentRecord[]>(() => {
    const list: UnifiedAgentRecord[] = [];

    puList.forEach((pu) => {
      const coAgents = pu.extraAgents.map((ex) => ({
        name: ex.name,
        sponsor: ex.owner,
        role: ex.role || "Protector",
        type: "extra",
      }));

      // 1. Official Party Agent
      if (pu.hasOfficialAgent) {
        list.push({
          id: `off-${pu.code}`,
          name: pu.officialAgentName || `Official Agent – ${pu.code}`,
          type: "official",
          sponsor: "Party Official",
          role: "Official Party Agent",
          phoneMasked: pu.officialAgentPhone || "+234 ••• ••• 671",
          telegramStatus: pu.officialAgentTelegramStatus || "connected",
          puCode: pu.code,
          puName: pu.name,
          puLocation: pu.location,
          latitude: pu.latitude,
          longitude: pu.longitude,
          hasGPS: pu.hasGPS,
          wardCode: pu.wardCode,
          lgaCode: pu.lgaCode,
          stateCode: pu.stateCode,
          coAgents,
        });
      } else {
        // Gap record
        list.push({
          id: `gap-${pu.code}`,
          name: "Unassigned Agent Slot",
          type: "gap",
          sponsor: "Party Official (Vacant)",
          role: "Unassigned Official Agent",
          phoneMasked: "—",
          telegramStatus: "not_matched",
          puCode: pu.code,
          puName: pu.name,
          puLocation: pu.location,
          latitude: pu.latitude,
          longitude: pu.longitude,
          hasGPS: pu.hasGPS,
          wardCode: pu.wardCode,
          lgaCode: pu.lgaCode,
          stateCode: pu.stateCode,
          coAgents,
        });
      }

      // 2. Extra Agents
      pu.extraAgents.forEach((ex) => {
        const otherAgents = [
          ...(pu.hasOfficialAgent
            ? [
                {
                  name: pu.officialAgentName || "Official Agent",
                  sponsor: "Party Official",
                  role: "Official Party Agent",
                  type: "official",
                },
              ]
            : []),
          ...pu.extraAgents
            .filter((e) => e.id !== ex.id)
            .map((e) => ({
              name: e.name,
              sponsor: e.owner,
              role: e.role || "Protector",
              type: "extra",
            })),
        ];

        list.push({
          id: `ex-${ex.id}`,
          name: ex.name,
          type: "extra",
          sponsor: ex.owner,
          role: ex.role || "Protector",
          phoneMasked: ex.phone || "+234 ••• ••• •••",
          telegramStatus: ex.telegramStatus || "connected",
          puCode: pu.code,
          puName: pu.name,
          puLocation: pu.location,
          latitude: pu.latitude,
          longitude: pu.longitude,
          hasGPS: pu.hasGPS,
          wardCode: pu.wardCode,
          lgaCode: pu.lgaCode,
          stateCode: pu.stateCode,
          coAgents: otherAgents,
        });
      });
    });

    return list;
  }, [puList]);

  // Tab counts
  const counts = useMemo(() => {
    return {
      all: allAgentRecords.length,
      official: allAgentRecords.filter((r) => r.type === "official").length,
      extra: allAgentRecords.filter((r) => r.type === "extra").length,
      gaps: allAgentRecords.filter((r) => r.type === "gap").length,
    };
  }, [allAgentRecords]);

  // Filter records
  const filteredAgents = useMemo(() => {
    return allAgentRecords.filter((record) => {
      // Type Tab filter
      if (selectedTypeTab === "official" && record.type !== "official") return false;
      if (selectedTypeTab === "extra" && record.type !== "extra") return false;
      if (selectedTypeTab === "gaps" && record.type !== "gap") return false;

      // State filter
      if (selectedState !== "all" && record.stateCode !== selectedState) return false;

      // LGA filter
      if (selectedLga !== "all" && record.lgaCode !== selectedLga) return false;

      // Ward filter
      if (selectedWard !== "all" && record.wardCode !== selectedWard) return false;

      // Sponsor filter
      if (selectedSponsor !== "all") {
        if (selectedSponsor === "Party" && !record.sponsor.includes("Party")) return false;
        if (selectedSponsor === "President" && !record.sponsor.includes("President")) return false;
        if (selectedSponsor === "Senate" && !record.sponsor.includes("Senate")) return false;
        if (selectedSponsor === "House of Reps" && !record.sponsor.includes("House of Reps")) return false;
        if (selectedSponsor === "State Assembly" && !record.sponsor.includes("State Assembly")) return false;
      }

      // Role filter
      if (selectedRole !== "all" && record.role !== selectedRole) return false;

      // Channel filter
      if (selectedChannel !== "all" && record.telegramStatus !== selectedChannel) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = record.name.toLowerCase().includes(q);
        const matchesPU = record.puName.toLowerCase().includes(q) || record.puCode.toLowerCase().includes(q);
        const matchesSponsor = record.sponsor.toLowerCase().includes(q);
        const matchesRole = record.role.toLowerCase().includes(q);
        if (!matchesName && !matchesPU && !matchesSponsor && !matchesRole) {
          return false;
        }
      }

      return true;
    });
  }, [
    allAgentRecords,
    selectedTypeTab,
    selectedState,
    selectedLga,
    selectedWard,
    selectedSponsor,
    selectedRole,
    selectedChannel,
    searchQuery,
  ]);

  const handleResetFilters = () => {
    setSelectedTypeTab("all");
    setSelectedState("all");
    setSelectedLga("all");
    setSelectedWard("all");
    setSelectedSponsor("all");
    setSelectedRole("all");
    setSelectedChannel("all");
    setSearchQuery("");
  };

  const handleAssignOfficial = (puCode: string) => {
    setPuList((prev) =>
      prev.map((pu) =>
        pu.code === puCode
          ? {
              ...pu,
              hasOfficialAgent: true,
              officialAgentName: `Official Agent – ${puCode}`,
              officialAgentPhone: "+234 ••• ••• 700",
              officialAgentTelegramStatus: "connected",
            }
          : pu
      )
    );
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "PU Code,PU Name,Location,Agent Name,Agent Type,Sponsor/Owner,Role,Phone (Masked),Channel Status\n";

    filteredAgents.forEach((a) => {
      csvContent += `"${a.puCode}","${a.puName}","${a.puLocation}","${a.name}","${a.type}","${a.sponsor}","${a.role}","${a.phoneMasked}","${a.telegramStatus}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ndc-agents-roster-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Polling Unit Agents Directory
            </h1>
            <Badge variant="outline" className="text-xs px-2 py-0.5 gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              1 Official Agent = Covered
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Monitor and coordinate official party agents and candidate-sponsored extra agents across polling units.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/broadcasts/new?group=agents"
            className="inline-flex items-center justify-center rounded-lg text-xs font-medium h-8 px-3.5 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Broadcast to Agents</span>
          </Link>
        </div>
      </div>

      {/* Top Metric Cards */}
      <AgentsKPISummary
        officialCount={counts.official}
        extraCount={counts.extra}
        gapsCount={counts.gaps}
        totalPUs={puList.length}
        telegramPct={72}
        smsPct={24}
      />

      {/* Filter Bar */}
      <AgentsFilters
        selectedTypeTab={selectedTypeTab}
        setSelectedTypeTab={setSelectedTypeTab}
        selectedState={selectedState}
        setSelectedState={setSelectedState}
        selectedLga={selectedLga}
        setSelectedLga={setSelectedLga}
        selectedWard={selectedWard}
        setSelectedWard={setSelectedWard}
        selectedSponsor={selectedSponsor}
        setSelectedSponsor={setSelectedSponsor}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
        selectedChannel={selectedChannel}
        setSelectedChannel={setSelectedChannel}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        totalFilteredCount={filteredAgents.length}
        counts={counts}
        onReset={handleResetFilters}
        onExportCSV={handleExportCSV}
      />

      {/* Table */}
      <AgentsTable
        agents={filteredAgents}
        onAssignOfficial={handleAssignOfficial}
      />
    </div>
  );
}
