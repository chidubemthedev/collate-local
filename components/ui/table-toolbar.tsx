"use client";

import type { ReactNode } from "react";
import { X, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export interface ActiveTableFilter {
  id: string;
  label: string;
  onRemove: () => void;
}

export function TableToolbar({
  children,
  actions,
  activeFilters = [],
  onClear,
}: {
  children: ReactNode;
  actions?: ReactNode;
  activeFilters?: ActiveTableFilter[];
  onClear?: () => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
          {children}
        </div>
        <Sheet>
          <SheetTrigger
            render={
              <Button variant="outline" size="sm" className="sm:hidden">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filters
                <Badge variant="secondary" className="ml-1 px-1.5">
                  {activeFilters.length}
                </Badge>
              </Button>
            }
          />
          <SheetContent side="right" className="w-[min(90vw,24rem)] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="space-y-3 px-4 pb-4">{children}</div>
          </SheetContent>
        </Sheet>
        {actions && <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">{actions}</div>}
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {activeFilters.map((filter) => (
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
      )}
    </div>
  );
}
