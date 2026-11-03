"use client";

import { CardListSkeleton, Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export function CandidatesDirectorySkeleton({ viewMode = "table" }: { viewMode?: "table" | "cards" }) {
  return (
    <div aria-busy="true" className="mx-auto max-w-7xl space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-8 w-44 shrink-0 rounded-lg" />
      </header>

      <section className="space-y-3 overflow-hidden rounded-xl border bg-card p-3 sm:p-4">
        <div className="flex gap-2 overflow-hidden border-b pb-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-7 w-24 shrink-0 rounded-lg" />
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-8 w-36" />
        </div>
        {viewMode === "table" ? (
          <TableSkeleton
            columns={[
              "Office",
              "Candidate",
              "Constituency / Seat",
              "Official Coverage",
              { label: "Extra Agents", className: "hidden md:table-cell text-right" },
              { label: "Channel Status", className: "hidden lg:table-cell" },
              { label: "Actions", className: "text-right" },
            ]}
          />
        ) : (
          <CardListSkeleton count={4} className="grid gap-3 sm:grid-cols-2" />
        )}
      </section>
    </div>
  );
}
