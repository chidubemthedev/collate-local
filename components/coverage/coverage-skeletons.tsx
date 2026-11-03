"use client";

import React from "react";
import { Skeleton, StatCardSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export function CoverageFiltersSkeleton() {
  return (
    <div className="space-y-3 bg-card border border-border/60 rounded-xl p-3 sm:p-4">
      {/* Top row: Unit mode tabs & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border/60">
        <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-lg w-fit">
          <Skeleton className="h-7 w-36 rounded-md" />
          <Skeleton className="h-7 w-28 rounded-md" />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-16" />
        </div>
      </div>

      {/* Main Filter Controls Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 items-end">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-8.5 w-full rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-8.5 w-full rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8.5 w-full rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8.5 w-full rounded-lg" />
        </div>
        <div className="space-y-1.5 col-span-2 md:col-span-1">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-8.5 w-full rounded-lg" />
        </div>
      </div>

      {/* Filter Quick Mode Pills */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>
    </div>
  );
}

export function KPISummarySkeleton() {
  return (
    <StatCardSkeleton count={6} />
  );
}

export function AtStakeCandidatesSkeleton() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24 rounded-full" />
        </div>
        <Skeleton className="h-3 w-48 hidden sm:block" />
      </div>

      <div className="border border-border/60 rounded-xl bg-card p-4 sm:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-5 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded" />
              <Skeleton className="h-3.5 w-28" />
            </div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3.5 w-56" />
          </div>
          <div className="lg:col-span-5 space-y-2">
            <div className="flex justify-between items-center">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-4 w-10" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex justify-between items-center">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="lg:col-span-2 flex lg:justify-end">
            <Skeleton className="h-8 w-full sm:w-36 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CoverageMapSkeleton() {
  return (
    <div className="border border-border/60 rounded-xl bg-card overflow-hidden">
      <div className="p-3.5 sm:p-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-24 rounded" />
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2">
          {Array.from({ length: 28 }).map((_, i) => (
            <div key={i} className="border border-border/40 rounded-lg p-2.5 space-y-2">
              <div className="flex justify-between items-center">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-6 rounded-full" />
              </div>
              <Skeleton className="h-2 w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CoverageTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <TableSkeleton
        columns={[
          "Code",
          "State",
          { label: "Total PUs", className: "text-right" },
          { label: "With GPS", className: "hidden md:table-cell text-right" },
          "Official Coverage",
          { label: "Extra Agents", className: "hidden sm:table-cell text-right" },
          { label: "Action", className: "text-right" },
        ]}
      />
    </div>
  );
}

export function CoverageDashboardSkeleton() {
  return (
    <div aria-busy="true" className="space-y-6 max-w-7xl mx-auto">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>

      <KPISummarySkeleton />
      <AtStakeCandidatesSkeleton />
      <CoverageMapSkeleton />
      <div className="space-y-3 rounded-xl border bg-card p-3 sm:p-4">
        <CoverageFiltersSkeleton />
        <CoverageTableSkeleton />
      </div>
    </div>
  );
}
