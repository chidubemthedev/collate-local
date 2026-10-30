"use client";

import React, { useState, useMemo } from "react";
import { RECIPIENTS_DATA } from "@/lib/data/recipients-data";
import { RecipientPerson } from "@/lib/types";
import { useApp } from "@/lib/context/app-context";
import { RecipientsKPISummary } from "@/components/recipients/recipients-kpi-summary";
import { RecipientsFilters } from "@/components/recipients/recipients-filters";
import { RecipientsTable } from "@/components/recipients/recipients-table";
import { AddRecipientModal } from "@/components/recipients/add-recipient-modal";
import { ImportCSVModal } from "@/components/recipients/import-csv-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  UserPlus,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Radio,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function RecipientsPage() {
  const router = useRouter();
  const { activePersona } = useApp();

  const [recipientsList, setRecipientsList] = useState<RecipientPerson[]>(RECIPIENTS_DATA);
  const [statusTab, setStatusTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedLga, setSelectedLga] = useState<string>("all");
  const [selectedSource, setSelectedSource] = useState<string>("all");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingRecipient, setEditingRecipient] = useState<RecipientPerson | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isCandidatePersona = activePersona.role.startsWith("Candidate");

  // Filtered recipients
  const filteredRecipients = useMemo(() => {
    return recipientsList.filter((person) => {
      // 1. Channel status tab
      if (statusTab !== "all" && person.telegramStatus !== statusTab) {
        return false;
      }

      // 2. Search query
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesName = person.name.toLowerCase().includes(query);
        const matchesArea = person.area.toLowerCase().includes(query);
        const matchesGroup = person.group.toLowerCase().includes(query);
        const matchesPhone = person.phoneMasked.toLowerCase().includes(query);
        const matchesSource = person.source.toLowerCase().includes(query);
        if (!matchesName && !matchesArea && !matchesGroup && !matchesPhone && !matchesSource) {
          return false;
        }
      }

      // 3. Group filter
      if (selectedGroup !== "all") {
        if (selectedGroup === "candidate") {
          if (!person.group.includes("NDC ·")) return false;
        } else if (selectedGroup === "official") {
          if (!person.group.toLowerCase().includes("official")) return false;
        } else if (selectedGroup === "extra") {
          if (!person.group.toLowerCase().includes("extra")) return false;
        }
      }

      // 4. State filter
      if (selectedState !== "all" && person.stateCode && person.stateCode !== selectedState) {
        return false;
      }

      // 5. LGA filter
      if (selectedLga !== "all" && person.lgaCode && person.lgaCode !== selectedLga) {
        return false;
      }

      // 6. Persona Scoping
      if (isCandidatePersona && activePersona.stateCode && person.stateCode) {
        if (person.stateCode !== activePersona.stateCode && person.area !== "Nigeria") {
          return false;
        }
      }

      return true;
    });
  }, [
    recipientsList,
    statusTab,
    searchQuery,
    selectedGroup,
    selectedState,
    selectedLga,
    isCandidatePersona,
    activePersona,
  ]);

  // Counts for status tabs
  const statusCounts = useMemo(() => {
    return {
      all: recipientsList.length,
      telegramConnected: recipientsList.filter(
        (r) => r.telegramStatus === "Telegram connected"
      ).length,
      smsOnly: recipientsList.filter((r) => r.telegramStatus === "SMS only").length,
      notMatched: recipientsList.filter((r) => r.telegramStatus === "Number not matched").length,
    };
  }, [recipientsList]);

  const isFiltered =
    statusTab !== "all" ||
    searchQuery.trim() !== "" ||
    selectedGroup !== "all" ||
    selectedState !== "all" ||
    selectedLga !== "all";

  const handleResetFilters = () => {
    setStatusTab("all");
    setSearchQuery("");
    setSelectedGroup("all");
    setSelectedState("all");
    setSelectedLga("all");
    setSelectedSource("all");
  };

  const handleOpenAdd = () => {
    setEditingRecipient(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (recipient: RecipientPerson) => {
    setEditingRecipient(recipient);
    setIsAddModalOpen(true);
  };

  const handleSaveRecipient = (saved: RecipientPerson) => {
    if (editingRecipient) {
      setRecipientsList((prev) =>
        prev.map((item) => (item.id === saved.id ? saved : item))
      );
      setToastMessage(`Updated personnel record for ${saved.name}.`);
    } else {
      setRecipientsList((prev) => [saved, ...prev]);
      setToastMessage(`Registered new personnel: ${saved.name}.`);
    }

    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleImportSuccess = (imported: RecipientPerson[]) => {
    setRecipientsList((prev) => [...imported, ...prev]);
    setToastMessage(`Successfully imported ${imported.length} new personnel records from CSV.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSendDirectPing = (person: RecipientPerson) => {
    router.push(`/broadcasts/new`);
  };

  const handleExportCSV = () => {
    const headers = [
      "ID",
      "Full Name",
      "Role / Group",
      "Assigned Area",
      "PU Code",
      "NDPA Masked Phone",
      "Channel Readiness",
      "Registry Source",
    ];

    const rows = filteredRecipients.map((r) => [
      r.id,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.group.replace(/"/g, '""')}"`,
      `"${r.area.replace(/"/g, '""')}"`,
      `"${r.puCode || ""}"`,
      `"${r.phoneMasked}"`,
      `"${r.telegramStatus}"`,
      `"${r.source.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ndc-recipients-registry-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
              <Users className="w-7 h-7 text-primary" />
              <span>Recipients & Directory</span>
            </h1>
            <Badge
              variant="outline"
              className="text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              NDPA 2023 Compliant
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
            Searchable registry of all NDC candidates, official polling unit agents, and campaign
            volunteers with Telegram bot and SMS channel readiness.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            className="h-10 text-xs font-medium gap-1.5 border-border"
          >
            <Upload className="w-4 h-4 text-primary" />
            <span>Import CSV</span>
          </Button>

          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="h-10 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Recipient</span>
          </Button>
        </div>
      </div>

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* KPI Metrics Summary */}
      <RecipientsKPISummary recipients={recipientsList} />

      {/* Filters Toolbar */}
      <RecipientsFilters
        statusTab={statusTab}
        onStatusTabChange={setStatusTab}
        statusCounts={statusCounts}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedGroup={selectedGroup}
        onGroupChange={setSelectedGroup}
        selectedState={selectedState}
        onStateChange={setSelectedState}
        selectedLga={selectedLga}
        onLgaChange={setSelectedLga}
        selectedSource={selectedSource}
        onSourceChange={setSelectedSource}
        onReset={handleResetFilters}
        isFiltered={isFiltered}
        onOpenAddModal={handleOpenAdd}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onExportCSV={handleExportCSV}
      />

      {/* Persona Notice if Scoped */}
      {isCandidatePersona && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              Showing personnel registered within <strong>{activePersona.label}</strong> subtree.
            </span>
          </div>
          <Badge variant="outline" className="bg-background text-amber-700 dark:text-amber-300 border-amber-300 text-[11px]">
            Candidate Scoped
          </Badge>
        </div>
      )}

      {/* Recipients Data Table */}
      <RecipientsTable
        recipients={filteredRecipients}
        onEditRecipient={handleOpenEdit}
        onSendDirectPing={handleSendDirectPing}
      />

      {/* Add / Edit Recipient Modal */}
      <AddRecipientModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        editingRecipient={editingRecipient}
        onSave={handleSaveRecipient}
      />

      {/* Import CSV Modal */}
      <ImportCSVModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
}
