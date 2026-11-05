"use client";

import React from "react";
import { BroadcastData } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Send,
  Clock,
  FileEdit,
  Eye,
  MapPin,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

interface BroadcastsTableProps {
  broadcasts: BroadcastData[];
  onPreview: (broadcast: BroadcastData) => void;
}

export function BroadcastsTable({ broadcasts, onPreview }: BroadcastsTableProps) {
  if (broadcasts.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border/70 text-muted-foreground uppercase tracking-wider font-semibold text-[11px]">
            <tr>
              <th className="py-3 px-4">Campaign Title & Target</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Sender & Channel</th>
              <th className="py-3 px-3">Audience</th>
              <th className="py-3 px-3">Timestamp</th>
              <th className="py-3 px-4">Delivery Rate</th>
              <th className="py-3 px-3">Acknowledged</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {broadcasts.map((broadcast) => {
              const isSent = broadcast.status === "Sent";
              const isScheduled = broadcast.status === "Scheduled";
              const isDraft = broadcast.status === "Draft";
              const totalRecipients = broadcast.candidatesCount + broadcast.agentsCount;

              return (
                <tr
                  key={broadcast.id}
                  className="hover:bg-muted/30 transition-colors group"
                >
                  {/* Title & Target */}
                  <td className="py-3.5 px-4 font-medium">
                    <div className="font-bold text-foreground text-xs group-hover:text-primary transition-colors">
                      {broadcast.title}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                      <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span>{broadcast.targetArea}</span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-3">
                    {isSent && (
                      <Badge className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[11px] font-semibold">
                        <Send className="w-3 h-3 mr-1" />
                        Sent
                      </Badge>
                    )}
                    {isScheduled && (
                      <Badge className="bg-blue-600/10 text-blue-700 dark:text-blue-400 border-blue-500/20 text-[11px] font-semibold">
                        <Clock className="w-3 h-3 mr-1" />
                        Scheduled
                      </Badge>
                    )}
                    {isDraft && (
                      <Badge variant="outline" className="bg-muted text-muted-foreground text-[11px]">
                        <FileEdit className="w-3 h-3 mr-1" />
                        Draft
                      </Badge>
                    )}
                  </td>

                  {/* Sender & Channel */}
                  <td className="py-3.5 px-3">
                    <div className="font-semibold text-foreground text-[11px]">
                      {broadcast.senderRole}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <span>{broadcast.channel}</span>
                    </div>
                  </td>

                  {/* Audience */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <div className="font-mono font-semibold text-foreground text-xs">
                      {totalRecipients.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {broadcast.candidatesCount > 0 && `${broadcast.candidatesCount} cand.`}
                      {broadcast.candidatesCount > 0 && broadcast.agentsCount > 0 && " + "}
                      {broadcast.agentsCount > 0 && `${broadcast.agentsCount} agents`}
                    </div>
                  </td>

                  {/* Timestamp */}
                  <td className="py-3.5 px-3 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                    {broadcast.sentAt}
                  </td>

                  {/* Delivery Rate */}
                  <td className="py-3.5 px-4 min-w-[140px]">
                    {isSent ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-foreground font-mono">
                            {broadcast.deliveredPct}%
                          </span>
                          <span className="text-muted-foreground font-mono text-[10px]">
                            {broadcast.delivered} / {broadcast.sent}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden flex">
                          <div
                            style={{ width: `${broadcast.deliveredPct}%` }}
                            className="h-full bg-emerald-500"
                          />
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <span>Telegram</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">Pending</span>
                    )}
                  </td>

                  {/* Acknowledged (Tapped OK) */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    {isSent ? (
                      <div>
                        <div className="font-bold text-primary font-mono text-xs">
                          {broadcast.tappedOkPct}%
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {broadcast.tappedOk.toLocaleString()} OK
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onPreview(broadcast)}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        title="Preview Message"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>

                      <Link
                        href={`/broadcasts/${broadcast.id}`}
                        className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 h-7 px-2.5"
                      >
                        <span>Report</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
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
