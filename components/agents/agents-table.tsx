"use client";

import React, { useState, useMemo } from "react";
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
import { AlertCircle, MapPin, UserPlus } from "lucide-react";

interface AgentsTableProps {
  agents: UnifiedAgentRecord[];
  onAssignOfficial?: (puCode: string) => void;
}

export function AgentsTable({ agents, onAssignOfficial }: AgentsTableProps) {
  const [selectedAgent, setSelectedAgent] = useState<UnifiedAgentRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const PAGE_SIZE = 10;

  // Back to the first page when the agent dataset changes (e.g. filters applied).
  // The page is stored with the dataset size it belongs to, so no reset effect is needed.
  const [pageState, setPageState] = useState({ key: agents.length, page: 1 });
  const currentPage = pageState.key === agents.length ? pageState.page : 1;
  const setCurrentPage = (update: (page: number) => number) =>
    setPageState({ key: agents.length, page: update(currentPage) });

  const totalPages = Math.max(1, Math.ceil(agents.length / PAGE_SIZE));
  const paginatedAgents = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return agents.slice(start, start + PAGE_SIZE);
  }, [agents, currentPage]);

  const handleOpenAgent = (agent: UnifiedAgentRecord) => {
    setSelectedAgent(agent);
    setIsModalOpen(true);
  };

  // Type is the agent kind stored on the assignment (no role is stored yet).
  const getTypeBadge = (type: UnifiedAgentRecord["type"]) => {
    switch (type) {
      case "official":
        return "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300";
      case "extra":
        return "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-w-0 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/40 text-xs">
            <TableRow>
              <TableHead className="w-32 font-semibold">PU Code</TableHead>
              <TableHead className="font-semibold min-w-[200px]">Polling Unit & Location</TableHead>
              <TableHead className="font-semibold min-w-[180px]">Agent Name & Type</TableHead>
              <TableHead className="font-semibold hidden md:table-cell min-w-[160px]">Sponsor / Owner</TableHead>
              <TableHead className="font-semibold hidden sm:table-cell">Type</TableHead>
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
              paginatedAgents.map((agent) => {
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
                          <span title={agent.puLocation} className="truncate max-w-[220px]">{agent.puLocation}</span>
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
                      <div title={agent.sponsor} className="text-xs text-foreground font-medium truncate max-w-[180px]">
                        {agent.sponsor}
                      </div>
                    </TableCell>

                    {/* Type */}
                    <TableCell className="hidden sm:table-cell">
                      {isGap ? (
                        <span className="text-muted-foreground text-[11px]">Unfilled</span>
                      ) : (
                        <Badge variant="outline" className={`text-[10px] ${getTypeBadge(agent.type)}`}>
                          {isOfficial ? "Official" : "Extra"}
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
                          {agent.telegramStatus && (
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
                              {agent.telegramStatus === "connected"
                                ? "Telegram"
                                : agent.telegramStatus === "sms_only"
                                ? "SMS Only"
                                : "Not matched"}
                            </Badge>
                          )}
                          {!agent.telegramStatus && (
                            <span className="text-[10px] text-muted-foreground">Not available yet</span>
                          )}
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

      {/* Pagination Footer */}
      {agents.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border/60 bg-muted/20 text-xs text-muted-foreground">
          <div>
            Showing <span className="font-semibold text-foreground">{(currentPage - 1) * PAGE_SIZE + 1}</span> to{" "}
            <span className="font-semibold text-foreground">
              {Math.min(currentPage * PAGE_SIZE, agents.length)}
            </span>{" "}
            of <span className="font-semibold text-foreground">{agents.length}</span> agent records
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs border-border/70"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="px-2 font-medium text-foreground text-xs">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs border-border/70"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      <AgentDetailModal
        agent={selectedAgent}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onAssignOfficial={onAssignOfficial}
      />
    </div>
  );
}
