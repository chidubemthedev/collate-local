"use client";

import type { ReactNode } from "react";

export interface ActiveTableFilter {
  id: string;
  label: string;
  onRemove: () => void;
}

/**
 * The active-filter chips (each removable) plus "Clear filters", as in the wireframes.
 * `meta` sits in front of the chips on the same row: a count ("135 candidates match", pass a string)
 * or controls such as the coverage "Show" pills (pass elements).
 * Renders nothing when there is neither meta nor a filter.
 */
export function ActiveFilterChips({
  filters,
  onClear,
  meta,
  showClear = filters.length > 0,
}: {
  filters: ActiveTableFilter[];
  onClear?: () => void;
  meta?: ReactNode;
  /** Show "Clear filters" even with no chips (for example when a "Show" pill is on). */
  showClear?: boolean;
}) {
  if (filters.length === 0 && !meta) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
      {typeof meta === "string" ? <span className="text-[12px] text-[#737373]">{meta}</span> : meta}
      {filters.map((filter) => (
        <span
          key={filter.id}
          className="inline-flex min-h-[26px] items-center gap-1 rounded-full border border-[#E5E5E5] bg-[#FAFAFA] pr-1 pl-2 text-[12px] text-[#0A0A0A]"
        >
          <span className="max-w-48 truncate">{filter.label}</span>
          <button
            type="button"
            aria-label={`Remove ${filter.label} filter`}
            onClick={filter.onRemove}
            className="h-5 w-5 rounded-[10px] border-0 bg-transparent text-[13px] leading-none text-[#737373] hover:bg-[#F0F0F0]"
          >
            ×
          </button>
        </span>
      ))}
      {onClear && showClear ? (
        <button
          type="button"
          onClick={onClear}
          className="min-h-[26px] border-0 bg-transparent px-1.5 text-[12px] font-semibold text-[#0A0A0A] underline"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
