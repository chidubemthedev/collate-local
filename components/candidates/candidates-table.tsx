"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { CandidateData } from "@/lib/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WF, Pill, Bar, officeTone, EmptyBox } from "@/components/ui/wf";
import { CandidateDetailModal } from "./candidate-detail-modal";
import { useCandidateViewAs } from "./candidate-view-as";
import { toTitleCase, type CandidateSortOrder } from "./candidates-filters";
import { coverageTier, CHANNEL_PILL, deputyTitle, coverageText } from "./candidate-pills";

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

const PAGE_SIZE = 25;

/** A sortable header, as in the wireframe: tap to sort, tap coverage again to reverse; ↕ when not sorted. */
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
  const arrow = !active ? "↕" : isDescending ? "↓" : "↑";
  const next = orders[(activeIndex + 1) % orders.length];

  return (
    <th
      scope="col"
      aria-sort={active ? (isDescending ? "descending" : "ascending") : "none"}
      className={`px-2 py-2.5 text-left ${className}`}
      title={title}
    >
      <button
        type="button"
        disabled={!onSortChange}
        onClick={() => onSortChange?.(next)}
        className="inline-flex min-h-7 items-center gap-1 border-0 bg-transparent p-0 text-[12px] font-semibold whitespace-nowrap text-[#0A0A0A] disabled:cursor-default"
      >
        {label}
        <span aria-hidden="true" className={`text-[11px] ${active ? "text-[#0A0A0A]" : "text-[#B0B0B0]"}`}>
          {arrow}
        </span>
      </button>
    </th>
  );
}

/** Previews the app with this candidate's seat; off (with the reason) for seats outside the user's access. */
function ViewAsLink({ seatId, large = false }: { seatId: number; large?: boolean }) {
  const viewAs = useCandidateViewAs(seatId);
  const text = `${large ? "text-[13px]" : "text-[12px]"} font-semibold whitespace-nowrap text-[#0A0A0A] underline`;
  if (viewAs.canView) {
    return (
      <button type="button" onClick={viewAs.start} className={`${text} min-h-7 border-0 bg-transparent p-0`}>
        View as
      </button>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} className="inline-flex cursor-not-allowed" />}>
        <span className={`${text} opacity-60`}>{viewAs.pending ? "Switching…" : "View as"}</span>
      </TooltipTrigger>
      <TooltipContent>{viewAs.title ?? "Not available"}</TooltipContent>
    </Tooltip>
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

  const currentPage = pageState.key === listKey ? pageState.page : 1;
  const setPage = (page: number) => setPageState({ key: listKey, page });

  // Pages cover every matching row; rows past those loaded are fetched when a page needs them.
  const totalItems = hasMore ? Math.max(candidates.length, totalCount ?? 0) : candidates.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);

  const startIndex = (page - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);

  const rows = candidates.slice(startIndex, endIndex);
  const pageNeedsMore = hasMore && endIndex > candidates.length;

  React.useEffect(() => {
    if (pageNeedsMore && !isLoadingMore) onLoadMore?.();
  }, [pageNeedsMore, isLoadingMore, onLoadMore]);

  const openDetails = (cand: CandidateData) => {
    setSelectedCandidate(cand);
    setIsModalOpen(true);
  };

  const stateLabel = (cand: CandidateData) => {
    if (!cand.stateCode) return "Nigeria";
    const name = stateNames?.get(cand.stateCode);
    return name ? toTitleCase(name) : cand.stateCode;
  };

  const sortProps = { sortOrder, onSortChange };

  if (candidates.length === 0 && !hasMore) {
    return <EmptyBox>No candidates match these filters.</EmptyBox>;
  }

  const loadingRow =
    rows.length === 0 && pageNeedsMore ? (
      <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-[#737373]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading candidates…
      </div>
    ) : null;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* Desktop table */}
      <div className={`${WF.card} hidden overflow-x-auto md:block`}>
        {loadingRow ?? (
          <table className={`${WF.table} min-w-[980px]`}>
            <thead>
              <tr>
                <SortHeader {...sortProps} label="Office" orders={["office"]} className="pl-4" />
                <SortHeader {...sortProps} label="Candidate" orders={["candidate"]} />
                <SortHeader {...sortProps} label="Constituency / seat" orders={["seat"]} />
                <SortHeader {...sortProps} label="State" orders={["state"]} />
                <SortHeader
                  {...sortProps}
                  label="Official coverage *"
                  orders={["coverage_asc", "coverage_desc"]}
                  title="A polling unit is covered when it has 1 official agent"
                />
                <SortHeader
                  {...sortProps}
                  label="Extra agents *"
                  orders={["extra_desc"]}
                  title="Extra agents of the candidate's own; they don't change coverage"
                />
                <th scope="col" className={WF.th} title="Whether we can reach the candidate on Telegram">
                  Channel *
                </th>
                <th scope="col" className={`${WF.th} pr-4`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((cand) => {
                const tier = coverageTier(cand);
                const channel = CHANNEL_PILL[cand.telegramStatus] ?? CHANNEL_PILL.not_matched;
                const selected = isModalOpen && selectedCandidate?.id === cand.id;
                return (
                  <tr key={cand.id} className={`${WF.tr} ${selected ? "bg-[#FAFAFA]" : ""}`}>
                    <td className={`${WF.td} pl-4 whitespace-nowrap`}>
                      <Pill tone={officeTone(cand.office)}>{cand.office}</Pill>
                    </td>
                    <td className={`${WF.td} min-w-[180px]`}>
                      <span className="flex flex-col gap-0.5">
                        <span className="font-semibold">{toTitleCase(cand.name)}</span>
                        {cand.deputyName ? (
                          <span className="text-[12px] text-[#8A8A8A]">
                            ({deputyTitle(cand.office)}) {toTitleCase(cand.deputyName)}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className={WF.td}>{toTitleCase(cand.seat)}</td>
                    <td className={`${WF.td} text-[#525252]`}>{stateLabel(cand)}</td>
                    <td className={`${WF.td} min-w-[230px]`}>
                      {cand.isOffCycle ? (
                        <Pill tone="amber">Off-cycle: not on the next election day</Pill>
                      ) : (
                        <span className="flex flex-col gap-[3px]">
                          <span className="flex items-center justify-between gap-2">
                            <span className="whitespace-nowrap tabular-nums">{coverageText(cand)}</span>
                            <Pill tone={tier.tone}>{tier.label}</Pill>
                          </span>
                          <Bar pct={cand.coveragePct} fill={tier.bar} track="#F0F0F0" />
                        </span>
                      )}
                    </td>
                    <td className={`${WF.td} whitespace-nowrap tabular-nums text-[#6D28D9]`}>
                      +{cand.extraAgentsCount.toLocaleString()}
                    </td>
                    <td className={`${WF.td} whitespace-nowrap`}>
                      <Pill tone={channel.tone}>{channel.label}</Pill>
                    </td>
                    <td className={`${WF.td} pr-4 text-right whitespace-nowrap`}>
                      <span className="inline-flex items-center gap-1.5">
                        <button type="button" className={WF.btnRow} onClick={() => openDetails(cand)}>
                          Details
                        </button>
                        <ViewAsLink seatId={cand.seatId} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Phone cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {loadingRow ??
          rows.map((cand) => {
            const tier = coverageTier(cand);
            const channel = CHANNEL_PILL[cand.telegramStatus] ?? CHANNEL_PILL.not_matched;
            return (
              <div key={cand.id} className={`${WF.card} flex flex-col gap-1.5 px-3.5 py-3`}>
                <span className="flex items-center justify-between gap-2">
                  <Pill tone={officeTone(cand.office)}>{cand.office}</Pill>
                  <Pill tone={channel.tone}>{channel.label}</Pill>
                </span>
                <span className="text-[15px] font-bold">{toTitleCase(cand.name)}</span>
                {cand.deputyName ? (
                  <span className="text-[12px] text-[#8A8A8A]">
                    ({deputyTitle(cand.office)}) {toTitleCase(cand.deputyName)}
                  </span>
                ) : null}
                <span className="text-[12px] text-[#525252]">
                  {toTitleCase(cand.seat)} · {stateLabel(cand)}
                </span>
                {cand.isOffCycle ? (
                  <Pill tone="amber">Off-cycle: not on the next election day</Pill>
                ) : (
                  <>
                    <span className="flex justify-between gap-1.5 text-[12px]">
                      <span className="tabular-nums">{coverageText(cand)}</span>
                      <Pill tone={tier.tone}>{tier.label}</Pill>
                    </span>
                    <Bar pct={cand.coveragePct} fill={tier.bar} track="#F0F0F0" />
                  </>
                )}
                <span className="text-[12px] tabular-nums text-[#6D28D9]">
                  +{cand.extraAgentsCount.toLocaleString()} extra agents of their own
                </span>
                <span className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    className={`${WF.btnRow} min-h-9 px-3 text-[13px]`}
                    onClick={() => openDetails(cand)}
                  >
                    Details
                  </button>
                  <ViewAsLink seatId={cand.seatId} large />
                </span>
              </div>
            );
          })}
      </div>

      {rows.length > 0 && pageNeedsMore ? (
        <p className="m-0 flex items-center gap-2 text-[12px] text-[#737373]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading more candidates…
        </p>
      ) : null}

      {totalItems > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] text-[#737373]">
            Showing {(startIndex + 1).toLocaleString()}–{endIndex.toLocaleString()} of {totalItems.toLocaleString()} candidate
            {totalItems !== 1 ? "s" : ""}
          </span>
          {totalPages > 1 ? (
            <span className="flex items-center gap-1.5">
              <button type="button" className={WF.btnOutline} disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span className="px-1 text-[12px] text-[#737373]">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className={WF.btnOutline}
                disabled={page >= totalPages || pageNeedsMore}
                onClick={() => setPage(page + 1)}
              >
                Next
                {pageNeedsMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              </button>
            </span>
          ) : null}
        </div>
      ) : null}

      <CandidateDetailModal
        candidate={selectedCandidate}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        stateName={selectedCandidate?.stateCode ? stateNames?.get(selectedCandidate.stateCode) ?? null : null}
      />
    </div>
  );
}
