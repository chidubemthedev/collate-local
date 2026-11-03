"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function CandidatesHeaderSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-60 sm:w-72 rounded-md" />
          <Skeleton className="h-5 w-28 rounded-full" />
        </div>
        <Skeleton className="h-4 w-72 sm:w-96 rounded-md" />
      </div>
      <Skeleton className="h-8 w-44 rounded-lg shrink-0" />
    </div>
  );
}

export function CandidatesFiltersSkeleton() {
  return (
    <div className="bg-card border border-border/70 rounded-xl p-3 sm:p-4 space-y-3">
      {/* Top Office Category Tabs & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border/60">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-7 w-20 rounded-lg" />
          <Skeleton className="h-7 w-28 rounded-lg" />
          <Skeleton className="h-7 w-28 rounded-lg" />
        </div>

        <Skeleton className="h-7 w-16 rounded-lg shrink-0 self-start sm:self-auto" />
      </div>

      {/* Main Filter Controls Grid: 2-cols on mobile, 4-cols on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-8.5 w-full rounded-md" />
          </div>
        ))}
      </div>

      {/* Bottom Action / Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
        <Skeleton className="h-4 w-44 rounded" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-7.5 w-24 rounded-md" />
          <Skeleton className="h-7.5 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function CandidatesTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="border border-border/70 rounded-xl overflow-hidden bg-card">
      {/* Table Header */}
      <div className="h-10 border-b border-border/60 bg-muted/40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-6 w-full text-xs">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3.5 w-28 hidden sm:block" />
          <Skeleton className="h-3.5 w-32 hidden md:block" />
          <Skeleton className="h-3.5 w-20 hidden lg:block ml-auto" />
        </div>
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-border/50">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="p-3.5 sm:px-4 flex items-center justify-between gap-4"
          >
            {/* Office badge */}
            <Skeleton className="h-5 w-20 rounded-md shrink-0" />

            {/* Candidate & Running mate */}
            <div className="space-y-1 flex-1 min-w-[140px]">
              <Skeleton className="h-4 w-36 sm:w-48 rounded" />
              <Skeleton className="h-3 w-28 sm:w-36 rounded" />
            </div>

            {/* Seat */}
            <div className="space-y-1 hidden sm:block w-32">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-2.5 w-16 rounded" />
            </div>

            {/* Coverage bar */}
            <div className="space-y-1.5 hidden md:block w-36">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>

            {/* Channel status */}
            <div className="hidden lg:block w-28">
              <Skeleton className="h-4 w-24 rounded-full" />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Skeleton className="h-6.5 w-16 rounded-md hidden sm:block" />
              <Skeleton className="h-6.5 w-14 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Table Pagination Footer Skeleton */}
      <div className="p-3 border-t border-border/60 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
        <Skeleton className="h-4 w-40 rounded" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-7 w-16 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function CandidatesCardsSkeleton({ cards = 8 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="border border-border/70 rounded-xl bg-card p-4 space-y-3 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-20 rounded" />
            <Skeleton className="h-3.5 w-16 rounded" />
          </div>

          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-3 w-28 rounded" />
          </div>

          <div className="flex items-center justify-between pt-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-16 rounded" />
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border/50">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Full page skeleton representing the Candidates directory in initial loading state.
 */
export function CandidatesDirectorySkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <CandidatesHeaderSkeleton />
      <CandidatesFiltersSkeleton />
      <CandidatesTableSkeleton rows={8} />
    </div>
  );
}
