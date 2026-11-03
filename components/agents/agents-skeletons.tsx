"use client";

import { Skeleton, StatCardSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export function AgentsDirectorySkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-7xl space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-8 w-40 shrink-0 rounded-lg" />
      </header>

      <StatCardSkeleton count={3} className="grid-cols-2 md:grid-cols-3" />

      <section className="space-y-3 overflow-hidden rounded-xl border bg-card p-3 sm:p-4">
        <div className="flex gap-2 border-b pb-3">
          <Skeleton className="h-7 w-28 rounded-lg" />
          <Skeleton className="h-7 w-36 rounded-lg" />
          <Skeleton className="h-7 w-36 rounded-lg" />
          <Skeleton className="h-7 w-36 rounded-lg" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-8 w-36" />
        </div>
        <TableSkeleton
          columns={[
            "PU Code",
            "Polling Unit & Location",
            "Agent Name & Type",
            { label: "Sponsor / Owner", className: "hidden md:table-cell" },
            { label: "Role", className: "hidden sm:table-cell" },
            { label: "Contact & Status", className: "hidden lg:table-cell" },
            { label: "Action", className: "text-right" },
          ]}
        />
      </section>
    </div>
  );
}
