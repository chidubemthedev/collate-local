"use client";

import React, { useState } from "react";
import { formatCoverage } from "@/lib/coverage/format";
import { CandidateData } from "@/lib/types";
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
import { Progress } from "@/components/ui/progress";
import { CandidateDetailModal } from "./candidate-detail-modal";
import {
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface CandidatesTableProps {
  candidates: CandidateData[];
}

export function CandidatesTable({ candidates }: CandidatesTableProps) {
  const [selectedCandidate, setSelectedCandidate] =
    useState<CandidateData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pageState, setPageState] = useState({ list: candidates, page: 1 });
  const PAGE_SIZE = 10;

  // Reset to the first page whenever the candidate list changes
  const currentPage = pageState.list === candidates ? pageState.page : 1;
  const setCurrentPage = (update: (page: number) => number) =>
    setPageState({ list: candidates, page: update(currentPage) });

  const totalItems = candidates.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);

  const paginatedCandidates = candidates.slice(startIndex, endIndex);

  const handleOpenCandidate = (cand: CandidateData) => {
    setSelectedCandidate(cand);
    setIsModalOpen(true);
  };

  const getOfficeBadgeColor = (office: string) => {
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

  return (
    <div className="min-w-0 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/40 text-xs">
            <TableRow>
              <TableHead className="w-28 font-semibold">Office</TableHead>
              <TableHead className="font-semibold min-w-[220px]">
                Candidate
              </TableHead>
              <TableHead className="font-semibold min-w-[140px]">
                Constituency / Seat
              </TableHead>
              <TableHead className="font-semibold min-w-[180px]">
                Official Coverage
              </TableHead>
              <TableHead className="text-right font-semibold hidden md:table-cell">
                Extra Agents
              </TableHead>
              <TableHead className="font-semibold hidden lg:table-cell">
                Channel Status
              </TableHead>
              <TableHead className="text-right font-semibold w-28">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-xs">
            {candidates.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-12 text-muted-foreground"
                >
                  No candidates match your filters.
                </TableCell>
              </TableRow>
            ) : (
              paginatedCandidates.map((cand) => {
                if (cand.isOffCycle) {
                  return (
                    <TableRow
                      key={cand.id}
                      className="hover:bg-muted/30 transition-colors bg-amber-500/5 dark:bg-amber-950/10 cursor-pointer"
                      onClick={() => handleOpenCandidate(cand)}
                    >
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getOfficeBadgeColor(cand.office)}
                        >
                          {cand.office}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {cand.name}
                        </div>
                        <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                          Off-cycle seat
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {cand.seat}
                      </TableCell>
                      <TableCell colSpan={3}>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300"
                        >
                          Not in the next election day (Off-Cycle)
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2 text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCandidate(cand);
                          }}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                }

                return (
                  <TableRow
                    key={cand.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => handleOpenCandidate(cand)}
                  >
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-semibold ${getOfficeBadgeColor(cand.office)}`}
                      >
                        {cand.office}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="font-semibold text-foreground text-sm">
                        {cand.name}
                      </div>
                      {cand.deputyName && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          & {cand.deputyName}{" "}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="font-medium text-foreground">
                        {cand.seat}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            {formatCoverage(cand.coveredPUs, cand.totalPUs, cand.coveragePct)}
                          </span>
                        </div>
                        <div className="w-full bg-emerald-100 dark:bg-emerald-950/40 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-600 dark:bg-emerald-500 h-1.5 rounded-full"
                            style={{
                              width: `${Math.min(100, cand.coveragePct)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-right font-mono text-indigo-600 dark:text-indigo-400 font-semibold hidden md:table-cell">
                      +{cand.extraAgentsCount.toLocaleString()}
                    </TableCell>

                    <TableCell className="hidden lg:table-cell">
                      <div className="space-y-0.5">
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 h-4 ${
                            cand.telegramStatus === "connected"
                              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300"
                              : cand.telegramStatus === "sms_only"
                                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-300"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {cand.telegramStatus === "connected"
                            ? "Telegram Connected"
                            : cand.telegramStatus === "sms_only"
                              ? "SMS Only"
                              : "Not Matched"}
                        </Badge>
                        {cand.phoneMasked && (
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {cand.phoneMasked}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6.5 text-[11px] px-2 text-primary"
                          onClick={() => handleOpenCandidate(cand)}
                        >
                          Details
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      {totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 px-3.5 py-2.5 border-t border-border/60 bg-muted/20 text-xs">
          <div className="text-muted-foreground text-center sm:text-left">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {startIndex + 1}
            </span>
            –<span className="font-semibold text-foreground">{endIndex}</span>{" "}
            of{" "}
            <span className="font-semibold text-foreground">
              {totalItems.toLocaleString()}
            </span>{" "}
            candidate ticket{totalItems !== 1 ? "s" : ""}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                className="h-7 text-xs px-2.5 gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </Button>

              <span className="text-xs px-2 text-muted-foreground font-medium">
                Page{" "}
                <span className="text-foreground font-semibold">
                  {safeCurrentPage}
                </span>{" "}
                of{" "}
                <span className="text-foreground font-semibold">
                  {totalPages}
                </span>
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={safeCurrentPage >= totalPages}
                className="h-7 text-xs px-2.5 gap-1"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      <CandidateDetailModal
        candidate={selectedCandidate}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </div>
  );
}
