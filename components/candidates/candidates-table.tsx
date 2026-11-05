"use client";

import React, { useState } from "react";
import { CandidateData } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CandidateDetailModal } from "./candidate-detail-modal";
import { toTitleCase, type CandidateSortOrder } from "./candidates-filters";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface CandidatesTableProps {
  candidates: CandidateData[];
  /** INEC state code → state name, for the State column. */
  stateNames?: Map<string, string>;
  sortOrder?: CandidateSortOrder;
  onSortChange?: (order: CandidateSortOrder) => void;
  /** Total matching rows on the server; may exceed the rows loaded so far. */
  totalCount?: number;
  /** More rows can be fetched from the server. */
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  /** Changes when filters or sort change; the table goes back to page 1 then. */
  resetKey?: string;
}

const OFFICE_BADGE: Record<string, string> = {
  President: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300",
  Governor: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  Senate: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  "House of Reps": "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300",
  "State Assembly": "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
};

const CHANNEL_BADGE: Record<CandidateData["telegramStatus"], { label: string; className: string }> = {
  connected: {
    label: "Connected",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  sms_only: {
    label: "Invited",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  },
  not_matched: {
    label: "Not connected",
    className: "bg-muted text-muted-foreground",
  },
};

function coverageTier(cand: CandidateData) {
  if (cand.totalPUs <= 0) {
    return { label: "Not mapped", className: "bg-muted text-muted-foreground" };
  }
  if (cand.coveragePct >= 50) {
    return { label: "High", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" };
  }
  if (cand.coveragePct >= 30) {
    return { label: "Medium", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" };
  }
  return { label: "Critical", className: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" };
}

function deputyTitle(office: string) {
  return office === "President" ? "Vice-President" : "Deputy";
}

const PILL = "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium";

/**
 * A sortable header. Text columns sort A–Z; coverage toggles highest/lowest first;
 * extra agents sorts most first.
 */
function SortHeader({
  label,
  orders,
  sortOrder,
  onSortChange,
  className = "",
  title,
}: {
  label: string;
  orders: CandidateSortOrder[];
  sortOrder?: CandidateSortOrder;
  onSortChange?: (order: CandidateSortOrder) => void;
  className?: string;
  title?: string;
}) {
  const activeIndex = sortOrder ? orders.indexOf(sortOrder) : -1;
  const active = activeIndex !== -1;
  const isDescending = active && (sortOrder === "coverage_desc" || sortOrder === "extra_desc");
  const Icon = !active ? ArrowUpDown : isDescending ? ArrowDown : ArrowUp;
  const next = orders[(activeIndex + 1) % orders.length];

  return (
    <TableHead className={`font-semibold text-foreground ${className}`} title={title}>
      <button
        type="button"
        disabled={!onSortChange}
        onClick={() => onSortChange?.(next)}
        className="inline-flex items-center gap-1 whitespace-nowrap disabled:cursor-default"
      >
        {label}
        <Icon className={`h-3 w-3 ${active ? "text-foreground" : "text-muted-foreground/60"}`} />
      </button>
    </TableHead>
  );
}

export function CandidatesTable({
  candidates,
  stateNames,
  sortOrder,
  onSortChange,
  totalCount,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  resetKey,
}: CandidatesTableProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Back to the first page when filters change (not when more rows are appended).
  const listKey: unknown = resetKey ?? candidates;
  const [pageState, setPageState] = useState<{ key: unknown; page: number }>({ key: listKey, page: 1 });
  const PAGE_SIZE = 10;

  const currentPage = pageState.key === listKey ? pageState.page : 1;
  const setCurrentPage = (update: (page: number) => number) =>
    setPageState({ key: listKey, page: update(currentPage) });

  // Pages cover every matching row; rows past those loaded are fetched when a page needs them.
  const totalItems = hasMore ? Math.max(candidates.length, totalCount ?? 0) : candidates.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);

  const paginatedCandidates = candidates.slice(startIndex, endIndex);
  const pageNeedsMore = hasMore && endIndex > candidates.length;

  React.useEffect(() => {
    if (pageNeedsMore && !isLoadingMore) onLoadMore?.();
  }, [pageNeedsMore, isLoadingMore, onLoadMore]);

  const handleOpenCandidate = (cand: CandidateData) => {
    setSelectedCandidate(cand);
    setIsModalOpen(true);
  };

  const stateLabel = (cand: CandidateData) => {
    if (!cand.stateCode) return "—";
    const name = stateNames?.get(cand.stateCode);
    return name ? toTitleCase(name) : cand.stateCode;
  };

  const sortProps = { sortOrder, onSortChange };

  return (
    <div className="min-w-0 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="text-xs">
            <TableRow className="hover:bg-transparent">
              <SortHeader {...sortProps} label="Office" orders={["office"]} className="w-32" />
              <SortHeader {...sortProps} label="Candidate" orders={["candidate"]} className="min-w-[200px]" />
              <SortHeader {...sortProps} label="Constituency / seat" orders={["seat"]} className="min-w-[160px]" />
              <SortHeader {...sortProps} label="State" orders={["state"]} />
              <SortHeader
                {...sortProps}
                label="Official coverage *"
                orders={["coverage_desc", "coverage_asc"]}
                className="min-w-[230px]"
                title="A polling unit is covered when it has 1 official agent"
              />
              <SortHeader
                {...sortProps}
                label="Extra agents *"
                orders={["extra_desc"]}
                title="Extra agents of the candidate's own; they don't change coverage"
              />
              <TableHead
                className="font-semibold text-foreground whitespace-nowrap"
                title="Whether we can reach the candidate on Telegram"
              >
                Channel *
              </TableHead>
              <TableHead className="w-40">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-xs">
            {candidates.length === 0 && !hasMore ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  No candidates match your filters.
                </TableCell>
              </TableRow>
            ) : paginatedCandidates.length === 0 && pageNeedsMore ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading candidates…
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              paginatedCandidates.map((cand) => {
                const tier = coverageTier(cand);
                const channel = CHANNEL_BADGE[cand.telegramStatus] ?? CHANNEL_BADGE.not_matched;

                return (
                  <TableRow key={cand.id} className="transition-colors hover:bg-muted/30">
                    <TableCell>
                      <span className={`${PILL} ${OFFICE_BADGE[cand.office] ?? "bg-muted text-muted-foreground"}`}>
                        {cand.office}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="font-semibold leading-tight text-foreground">{toTitleCase(cand.name)}</div>
                      {cand.deputyName && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          ({deputyTitle(cand.office)}) {toTitleCase(cand.deputyName)}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-foreground">{toTitleCase(cand.seat)}</TableCell>

                    <TableCell className="text-muted-foreground">{stateLabel(cand)}</TableCell>

                    <TableCell>
                      {cand.isOffCycle ? (
                        <span className={`${PILL} bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300`}>
                          Off-cycle: not on the next election day
                        </span>
                      ) : (
                        <div className="w-[230px] space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="whitespace-nowrap tabular-nums text-foreground">
                              {cand.totalPUs > 0
                                ? `${cand.coveredPUs.toLocaleString()} of ${cand.totalPUs.toLocaleString()} (${cand.coveragePct}%)`
                                : "No units mapped"}
                            </span>
                            <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${tier.className}`}>
                              {tier.label}
                            </span>
                          </div>
                          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500"
                              style={{ width: `${Math.min(100, Math.max(0, cand.coveragePct))}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="tabular-nums text-purple-600 dark:text-purple-400">
                      +{cand.extraAgentsCount.toLocaleString()}
                    </TableCell>

                    <TableCell>
                      <span className={`${PILL} ${channel.className}`}>{channel.label}</span>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs font-medium"
                          onClick={() => handleOpenCandidate(cand)}
                        >
                          Details
                        </Button>
                        <button
                          type="button"
                          aria-disabled="true"
                          title="Not available yet"
                          className="cursor-not-allowed whitespace-nowrap text-xs font-semibold text-foreground underline underline-offset-2"
                        >
                          View as
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
            {paginatedCandidates.length > 0 && pageNeedsMore && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-4 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading more candidates…
                  </span>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      {totalItems > 0 && (
        <div className="flex flex-col items-center justify-between gap-2.5 border-t border-border/60 px-1 pt-3 text-xs sm:flex-row">
          <div className="text-center text-muted-foreground sm:text-left">
            Showing {startIndex + 1}–{endIndex} of {totalItems.toLocaleString()} candidate
            {totalItems !== 1 ? "s" : ""}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                className="h-7 gap-1 px-2.5 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </Button>

              <span className="px-2 text-xs font-medium text-muted-foreground">
                Page <span className="font-semibold text-foreground">{safeCurrentPage}</span> of{" "}
                <span className="font-semibold text-foreground">{totalPages}</span>
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages || pageNeedsMore}
                className="h-7 gap-1 px-2.5 text-xs"
              >
                Next
                {pageNeedsMore ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      <CandidateDetailModal
        candidate={selectedCandidate}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        stateName={selectedCandidate?.stateCode ? stateNames?.get(selectedCandidate.stateCode) ?? null : null}
      />
    </div>
  );
}
