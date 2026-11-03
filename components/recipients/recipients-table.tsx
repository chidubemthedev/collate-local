"use client";

import React from "react";
import type { AgentListItem } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Bot, AlertCircle, ExternalLink, MapPin, Lock, User } from "lucide-react";
import Link from "next/link";

interface RecipientsTableProps {
  recipients: AgentListItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function RecipientsTable({
  recipients,
  isLoading,
  isError,
  onRetry,
}: RecipientsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading recipients">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-lg bg-muted/60" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive"
      >
        <span>Could not load recipients.</span>
        <button type="button" className="font-semibold underline" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (recipients.length === 0) {
    return (
      <div className="p-12 text-center border border-dashed border-border rounded-xl bg-card space-y-2">
        <div className="w-10 h-10 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
          <User className="w-5 h-5" />
        </div>
        <div className="text-xs font-bold text-foreground">No personnel records found</div>
        <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
          No personnel match your selected filters. Try broadening your search or resetting
          filters.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold text-[11px]">
            <tr>
              <th className="py-3 px-4">Personnel & NDPA Contact</th>
              <th className="py-3 px-3">Role / Ticket</th>
              <th className="py-3 px-3">Jurisdiction / Polling Unit</th>
              <th className="py-3 px-3">Telegram</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {recipients.map((agent) => {
              const unit = agent.pollingUnit;
              const area = [unit.name ?? unit.inecPollingUnitCode, unit.wardName, unit.lgaName, unit.stateName].join(", ");
              return (
                <tr key={agent.assignmentId} className="hover:bg-muted/30 transition-colors group">
                  <td className="py-3.5 px-4 font-medium">
                    <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>{agent.fullName}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                      <Lock className="w-2.5 h-2.5 text-muted-foreground/60" />
                      <span>{agent.maskedPhone ?? "No phone on file"}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <Badge
                      variant="outline"
                      className={`text-[11px] border ${
                        agent.agentKind === "official"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-semibold"
                          : "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20"
                      }`}
                    >
                      {agent.agentKind === "official" ? "Official Agent" : "Extra Agent"}
                    </Badge>
                    <span className="block text-[10px] text-muted-foreground mt-0.5 max-w-[12rem] truncate" title={agent.owner.displayName}>
                      {agent.owner.displayName}
                    </span>
                  </td>

                  <td className="py-3.5 px-3 min-w-[200px]">
                    <div title={area} className="flex items-center gap-1 text-foreground/90 font-medium text-xs">
                      <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="line-clamp-1">{area}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono block mt-0.5">
                      PU Code: {unit.inecPollingUnitCode}
                    </span>
                  </td>

                  <td className="py-3.5 px-3 whitespace-nowrap">
                    {agent.telegramConnected ? (
                      <Badge className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[11px] font-semibold gap-1 py-0.5">
                        <Bot className="w-3 h-3" />
                        <span>Connected</span>
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-600/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[11px] font-semibold gap-1 py-0.5">
                        <AlertCircle className="w-3 h-3" />
                        <span>Not connected</span>
                      </Badge>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <Link
                      href="/coverage"
                      className="inline-flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground h-7 px-2 rounded-md hover:bg-muted transition-colors"
                      title="Inspect coverage"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
