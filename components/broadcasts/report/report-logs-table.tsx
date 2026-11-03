"use client";

import React from "react";
import { BroadcastRecipientLog } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  CheckCheck,
  Smartphone,
  Clock,
  AlertTriangle,
  RotateCw,
  ExternalLink,
  MapPin,
  Lock,
  User,
} from "lucide-react";
import Link from "next/link";

interface ReportLogsTableProps {
  logs: BroadcastRecipientLog[];
}

export function ReportLogsTable({
  logs,
}: ReportLogsTableProps) {
  if (logs.length === 0) {
    return (
      <div className="p-12 text-center border border-dashed border-border rounded-xl bg-card space-y-2">
        <div className="w-10 h-10 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
          <Clock className="w-5 h-5" />
        </div>
        <div className="text-xs font-bold text-foreground">No matching recipient records</div>
        <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
          No dispatches match your selected filter criteria. Try choosing another status tab or
          clearing your search.
        </p>
      </div>
    );
  }

  const renderStatusBadge = (status: BroadcastRecipientLog["status"]) => {
    switch (status) {
      case "Tapped OK":
        return (
          <Badge className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[11px] font-semibold gap-1 py-0.5">
            <CheckCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Tapped OK</span>
          </Badge>
        );
      case "Delivered":
        return (
          <Badge className="bg-blue-600/10 text-blue-700 dark:text-blue-400 border-blue-500/20 text-[11px] font-semibold gap-1 py-0.5">
            <CheckCircle2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <span>Delivered</span>
          </Badge>
        );
      case "Delivered by SMS":
        return (
          <Badge className="bg-purple-600/10 text-purple-700 dark:text-purple-400 border-purple-500/20 text-[11px] font-semibold gap-1 py-0.5">
            <Smartphone className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            <span>Delivered by SMS</span>
          </Badge>
        );
      case "Pending":
        return (
          <Badge className="bg-amber-600/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[11px] font-semibold gap-1 py-0.5">
            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>Pending</span>
          </Badge>
        );
      case "Failed":
        return (
          <Badge className="bg-rose-600/10 text-rose-700 dark:text-rose-400 border-rose-500/20 text-[11px] font-semibold gap-1 py-0.5">
            <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            <span>Failed</span>
          </Badge>
        );
      default:
        return null;
    }
  };

  const getGroupBadgeClass = (group: string) => {
    if (group.includes("Senate") || group.includes("Reps") || group.includes("Assembly")) {
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
    }
    if (group.includes("Official")) {
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
    }
    return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20";
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold text-[11px]">
            <tr>
              <th className="py-3 px-4">Recipient</th>
              <th className="py-3 px-3">Role / Group</th>
              <th className="py-3 px-3">Jurisdiction / Area</th>
              <th className="py-3 px-3">Time</th>
              <th className="py-3 px-3">Delivery Status</th>
              <th className="py-3 px-3">Source Citation</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {logs.map((log) => {
              const isFailedOrPending = log.status === "Failed" || log.status === "Pending";

              return (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors group">
                  {/* Recipient Name & Masked Phone */}
                  <td className="py-3.5 px-4 font-medium">
                    <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>{log.name}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                      <Lock className="w-2.5 h-2.5 text-muted-foreground/60" />
                      <span>{log.phoneMasked || "+234 ••• ••• 671"}</span>
                    </div>
                  </td>

                  {/* Group / Role */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-medium border ${getGroupBadgeClass(log.group)}`}
                    >
                      {log.group}
                    </Badge>
                  </td>

                  {/* Area / PU */}
                  <td className="py-3.5 px-3 min-w-[200px]">
                    <div className="flex items-center gap-1 text-foreground/90 font-medium text-xs">
                      <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="line-clamp-1">{log.area}</span>
                    </div>
                  </td>

                  {/* Time */}
                  <td className="py-3.5 px-3 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                    {log.time} WAT
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    {renderStatusBadge(log.status)}
                  </td>

                  {/* Source Citation */}
                  <td className="py-3.5 px-3 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                    {log.source}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {isFailedOrPending ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          title="Not available yet"
                          className="h-7 px-2.5 text-xs gap-1 font-semibold"
                        >
                          <RotateCw className="w-3 h-3" />
                          <span>Resend: Not available yet</span>
                        </Button>
                      ) : (
                        <Link
                          href="/coverage"
                          className="inline-flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground h-7 px-2 rounded-md hover:bg-muted transition-colors"
                        >
                          <span>View PU</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
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
