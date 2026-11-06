"use client";

import { useState, type ReactNode } from "react";

import { ActiveFilterChips, type ActiveTableFilter } from "@/components/ui/active-filter-chips";

export type { ActiveTableFilter };

/**
 * Filter area from the wireframes. On phones the fields fold behind a full-width "Filters" bar
 * (the summary on its right); from `sm` up they are always shown. Chips and "Clear filters" go below.
 */
export function TableToolbar({
  children,
  actions,
  activeFilters = [],
  onClear,
  summary,
  meta,
  showClear,
}: {
  children: ReactNode;
  actions?: ReactNode;
  activeFilters?: ActiveTableFilter[];
  onClear?: () => void;
  /** Right-hand text on the phone "Filters" bar. Defaults to the number of filters set. */
  summary?: ReactNode;
  /** Text before the chips, for example "135 candidates match". */
  meta?: ReactNode;
  /** Show "Clear filters" even when no chip is set. */
  showClear?: boolean;
  /** Kept for older callers; the phone layout is always inline now. */
  inlineMobile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const summaryText =
    summary ?? (activeFilters.length ? `${activeFilters.length} set` : "None set");

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-10 w-full items-center justify-between rounded-[8px] border border-[#E5E5E5] bg-white px-3 text-[13px] font-semibold text-[#0A0A0A] sm:hidden"
      >
        <span>{open ? "Hide filters" : "Filters"}</span>
        <span className="text-[12px] font-medium text-[#737373]">{summaryText}</span>
      </button>

      <div className={`${open ? "block" : "hidden"} min-w-0 sm:block`}>{children}</div>

      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}

      <div className={`${open ? "block" : "hidden"} sm:block`}>
        <ActiveFilterChips filters={activeFilters} onClear={onClear} meta={meta} showClear={showClear} />
      </div>
    </div>
  );
}
