"use client";

import React, { useState } from "react";
import { UnifiedAgentRecord, AgentDetailModal } from "./agent-detail-modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Users,
  AlertCircle,
  MapPin,
  ExternalLink,
  Send,
  Eye,
  UserPlus,
} from "lucide-react";
import Link from "next/link";

interface AgentsTableProps {
  agents: UnifiedAgentRecord[];
  onAssignOfficial?: (puCode: string) => void;
}

export function AgentsTable({ agents, onAssignOfficial }: AgentsTableProps) {
  const [selectedAgent, setSelectedAgent] = useState<UnifiedAgentRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenAgent = (agent: UnifiedAgentRecord) => {
    setSelectedAgent(agent);
    setIsModalOpen(true);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "Official Party Agent":
        return "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300";
      case "Protector":
        return "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300";
      case "Mobiliser":
        return "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200";
      case "Snapper":
        return "bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="border border-border/80 rounded-xl overflow-hidden bg-card shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/40 text-xs">
            <TableRow>
              <TableHead className="w-32 font-semibold">PU Code</TableHead>
              <TableHead className="font-semibold min-w-[200px]">Polling Unit & Location</TableHead>
              <TableHead className="font-semibold min-w-[180px]">Agent Name & Type</TableHead>
              <TableHead className="font-semibold hidden md:table-cell min-w-[160px]">Sponsor / Owner</TableHead>
              <TableHead className="font-semibold hidden sm:table-cell">Role</TableHead>
              <TableHead className="font-semibold hidden lg:table-cell">Contact & Status</TableHead>
              <TableHead className="text-right font-semibold w-24">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-xs">
            {agents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No agent records match your filter criteria.
                </TableCell>
              </TableRow>
            ) : (
              agents.map((agent) => {
                const isGap = agent.type === "gap";
                const isOfficial = agent.type === "official";

                return (
                  <TableRow
                    key={agent.id}
                    className={`hover:bg-muted/30 transition-colors cursor-pointer ${
                      isGap ? "bg-amber-500/5 dark:bg-amber-950/10" : ""
                    }`}
                    onClick={() => handleOpenAgent(agent)}
                  >
                    {/* PU Code */}
                    <TableCell className="font-mono font-bold text-foreground">
                      <span className="p-1 rounded bg-muted/60">{agent.puCode}</span>
                    </TableCell>

                    {/* PU Name & Location */}
                    <TableCell>
                      <div>
                        <div className="font-semibold text-foreground text-xs">{agent.puName}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                          <span className="truncate max-w-[220px]">{agent.puLocation}</span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Agent Name & Type */}
                    <TableCell>
                      {isGap ? (
                        <div className="space-y-0.5">
                          <Badge variant="destructive" className="bg-amber-600 text-white text-[10px] px-1.5 py-0 h-4 gap-1">
                            <AlertCircle className="w-2.5 h-2.5" />
                            GAP (Unassigned)
                          </Badge>
                          <div className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                            No Official Agent
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="font-semibold text-foreground text-xs">{agent.name}</div>
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1 py-0 h-3.5 ${
                              isOfficial
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300"
                                : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200"
                            }`}
                          >
                            {isOfficial ? "Official Party Agent" : "Extra Agent"}
                          </Badge>
                        </div>
                      )}
                    </TableCell>

                    {/* Sponsor / Owner */}
                    <TableCell className="hidden md:table-cell">
                      <div className="text-xs text-foreground font-medium truncate max-w-[180px]">
                        {agent.sponsor}
                      </div>
                    </TableCell>

                    {/* Role */}
                    <TableCell className="hidden sm:table-cell">
                      {isGap ? (
                        <span className="text-muted-foreground text-[11px]">Unfilled</span>
                      ) : (
                        <Badge variant="outline" className={`text-[10px] ${getRoleBadge(agent.role)}`}>
                          {agent.role}
                        </Badge>
                      )}
                    </TableCell>

                    {/* Contact & Status */}
                    <TableCell className="hidden lg:table-cell">
                      {!isGap ? (
                        <div className="space-y-0.5">
                          <div className="font-mono text-[11px] text-foreground">
                            {agent.phoneMasked}
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1 py-0 h-3.5 ${
                              agent.telegramStatus === "connected"
                                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300"
                                : agent.telegramStatus === "sms_only"
                                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-300"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {agent.telegramStatus === "connected" ? "Telegram" : "SMS Only"}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </TableCell>

                    {/* Action */}
                    <TableCell className="text-right">
                      {isGap ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6.5 text-[11px] px-2 text-amber-800 dark:text-amber-300 border-amber-400 gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAgent(agent);
                          }}
                        >
                          <UserPlus className="w-2.5 h-2.5" />
                          <span>Assign</span>
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6.5 text-[11px] px-2 text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAgent(agent);
                          }}
                        >
                          Inspect
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AgentDetailModal
        agent={selectedAgent}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onAssignOfficial={onAssignOfficial}
      />
    </div>
  );
}
