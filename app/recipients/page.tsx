"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RecipientsKPISummary } from "@/components/recipients/recipients-kpi-summary";
import { RecipientsFilters } from "@/components/recipients/recipients-filters";
import { RecipientsTable } from "@/components/recipients/recipients-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { useAgentsInfinite, useAgentSummary } from "@/lib/hooks/use-agents";
import { useGeographyLgas, useGeographyStates } from "@/lib/hooks/use-geography";
import type { AgentsQueryFilters, AgentsSummaryFilters } from "@/types/api";

const SEARCH_DEBOUNCE_MS = 300;

function csvCell(value: string): string {
  // Leading formula characters would execute when the file is opened in a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export default function RecipientsPage() {
  const [statusTab, setStatusTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedLga, setSelectedLga] = useState<string>("all");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const states = useGeographyStates().data ?? [];
  const stateId = states.find((state) => state.code === selectedState)?.id;
  const lgas = useGeographyLgas(stateId ?? null).data ?? [];
  const lgaId = stateId ? lgas.find((lga) => lga.code === selectedLga)?.id : undefined;

  const summaryFilters = useMemo<AgentsSummaryFilters>(
    () => ({
      ...(stateId !== undefined && { stateId: Number(stateId) }),
      ...(lgaId !== undefined && { lgaId: Number(lgaId) }),
      ...(debouncedSearch && { q: debouncedSearch }),
    }),
    [stateId, lgaId, debouncedSearch],
  );

  const listFilters = useMemo<Omit<AgentsQueryFilters, "cursor" | "limit">>(
    () => ({
      ...summaryFilters,
      ...(selectedGroup !== "all" && { agentKind: selectedGroup as "official" | "extra" }),
      ...(statusTab !== "all" && { channel: statusTab as "telegram" | "not_connected" }),
    }),
    [summaryFilters, selectedGroup, statusTab],
  );

  const summaryQuery = useAgentSummary(summaryFilters);
  const agentsQuery = useAgentsInfinite(listFilters);
  const recipients = useMemo(
    () => agentsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [agentsQuery.data],
  );

  const isFiltered =
    statusTab !== "all" ||
    searchQuery.trim() !== "" ||
    selectedGroup !== "all" ||
    selectedState !== "all" ||
    selectedLga !== "all";

  const handleResetFilters = () => {
    setStatusTab("all");
    setSearchQuery("");
    setDebouncedSearch("");
    setSelectedGroup("all");
    setSelectedState("all");
    setSelectedLga("all");
  };

  const handleStateChange = (code: string) => {
    setSelectedState(code);
    setSelectedLga("all");
  };

  const handleExportCSV = () => {
    const headers = [
      "Full Name",
      "Role",
      "Owner",
      "State",
      "LGA",
      "Ward",
      "Polling Unit",
      "PU Code",
      "Masked Phone",
      "Telegram",
    ];

    const rows = recipients.map((agent) => [
      agent.fullName,
      agent.agentKind === "official" ? "Official Agent" : "Extra Agent",
      agent.owner.displayName,
      agent.pollingUnit.stateName,
      agent.pollingUnit.lgaName,
      agent.pollingUnit.wardName,
      agent.pollingUnit.name ?? "",
      agent.pollingUnit.inecPollingUnitCode,
      agent.maskedPhone ?? "",
      agent.telegramConnected ? "Connected" : "Not connected",
    ]);

    const csvContent = [
      headers.map(csvCell).join(","),
      ...rows.map((row) => row.map(csvCell).join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `recipients-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className="text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              NDPA 2023 Compliant
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5 mt-2">
            <Users className="w-5 h-5 text-primary" />
            <span>Recipients & Directory</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
            Searchable registry of the official and extra polling unit agents you
            can reach, with their Telegram connection status.
          </p>
        </div>
      </div>

      <RecipientsKPISummary
        summary={summary}
        isLoading={summaryQuery.isPending}
        isError={summaryQuery.isError}
        onRetry={() => void summaryQuery.refetch()}
      />

      <section className="min-w-0 space-y-3 overflow-hidden rounded-xl border border-border/70 bg-card p-3 sm:p-4">
        <RecipientsFilters
          statusTab={statusTab}
          onStatusTabChange={setStatusTab}
          statusCounts={
            summary && {
              all: summary.total,
              telegramConnected: summary.telegramConnected,
              notConnected: summary.notConnected,
            }
          }
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedGroup={selectedGroup}
          onGroupChange={setSelectedGroup}
          selectedState={selectedState}
          onStateChange={handleStateChange}
          selectedLga={selectedLga}
          onLgaChange={setSelectedLga}
          onReset={handleResetFilters}
          isFiltered={isFiltered}
          onExportCSV={handleExportCSV}
          canExport={recipients.length > 0}
        />
        <RecipientsTable
          recipients={recipients}
          isLoading={agentsQuery.isPending}
          isError={agentsQuery.isError && recipients.length === 0}
          onRetry={() => void agentsQuery.refetch()}
        />
        {recipients.length > 0 && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-muted-foreground">
              Showing {recipients.length.toLocaleString()} loaded
            </span>
            {agentsQuery.hasNextPage && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={agentsQuery.isFetchingNextPage}
                onClick={() => void agentsQuery.fetchNextPage()}
              >
                {agentsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
