"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { ActiveFilterChips, type ActiveTableFilter } from "@/components/ui/active-filter-chips";

export type { ActiveTableFilter };

const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

/**
 * Folds its content open and shut on phones; always open from `sm` up.
 * Animates the row height (grid 0fr -> 1fr), so it works for any content height, with a short
 * fade and drop on the content. Closed, it is `invisible` (after the animation), so the fields
 * are skipped by Tab and screen readers. The negative margin cancels the parent's gap.
 */
function MobileCollapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className={`grid transition-[grid-template-rows,margin-top,visibility] duration-300 ${EASE} motion-reduce:transition-none sm:visible sm:mt-0 sm:grid-rows-[1fr] ${
        open ? "visible grid-rows-[1fr]" : "invisible -mt-3 grid-rows-[0fr]"
      }`}
    >
      {/* Slight inner padding so focus rings are not cut off while the panel clips. */}
      <div className="-m-1 min-h-0 min-w-0 overflow-hidden p-1 sm:overflow-visible">
        <div
          className={`transition-[opacity,transform] duration-300 ${EASE} motion-reduce:transition-none sm:translate-y-0 sm:opacity-100 ${
            open ? "translate-y-0 opacity-100" : "-translate-y-1.5 opacity-0"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

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
        className={`flex min-h-10 w-full items-center justify-between rounded-[8px] border bg-white px-3 text-[13px] font-semibold text-[#0A0A0A] transition-[border-color,box-shadow,transform] duration-200 ${EASE} active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 sm:hidden ${
          open ? "border-[#D4D4D4] shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "border-[#E5E5E5]"
        }`}
      >
        <span>{open ? "Hide filters" : "Filters"}</span>
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#737373]">
          {summaryText}
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 transition-transform duration-300 ${EASE} motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      <MobileCollapse open={open}>{children}</MobileCollapse>

      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}

      <MobileCollapse open={open}>
        <ActiveFilterChips filters={activeFilters} onClear={onClear} meta={meta} showClear={showClear} />
      </MobileCollapse>
    </div>
  );
}
