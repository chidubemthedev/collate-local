"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ActiveTableFilter {
  id: string;
  label: string;
  onRemove: () => void;
}

/** The active-filter chips (each removable) plus "Clear filters". Renders nothing when no filter is set. */
export function ActiveFilterChips({
  filters,
  onClear,
}: {
  filters: ActiveTableFilter[];
  onClear?: () => void;
}) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
      {filters.map((filter) => (
        <Badge key={filter.id} variant="secondary" className="gap-1 pr-1">
          <span className="max-w-48 truncate">{filter.label}</span>
          <button
            type="button"
            aria-label={`Remove ${filter.label} filter`}
            onClick={filter.onRemove}
            className="rounded-full p-0.5 hover:bg-background/70"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {onClear && (
        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
