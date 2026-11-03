"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function AgentsHeaderSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-64 sm:w-80 rounded-md" />
          <Skeleton className="h-5 w-32 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full hidden sm:inline-flex" />
        </div>
        <Skeleton className="h-4 w-72 sm:w-96 rounded-md" />
      </div>
      <Skeleton className="h-8 w-40 rounded-lg shrink-0" />
    </div>
  );
}

export function AgentsKPISummarySkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {/* Official Party Agents Skeleton */}
      <div className="bg-card border border-border/70 rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-3.5 w-3.5 rounded-full" />
        </div>
        <div className="space-y-2 pt-1">
          <div className="flex items-baseline justify-between">
            <Skeleton className="h-7 w-20 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
          <Skeleton className="h-3 w-40 rounded" />
        </div>
      </div>

      {/* Candidate Extra Agents Skeleton */}
      <div className="bg-card border border-border/70 rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-36 rounded" />
          <Skeleton className="h-4 w-12 rounded-full" />
        </div>
        <div className="space-y-2 pt-1">
          <Skeleton className="h-7 w-16 rounded" />
          <Skeleton className="h-3 w-44 rounded" />
        </div>
      </div>

      {/* Coverage Gaps Skeleton */}
      <div className="col-span-2 md:col-span-1 bg-card border border-border/70 rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
        <div className="space-y-2 pt-1">
          <Skeleton className="h-7 w-24 rounded" />
          <Skeleton className="h-3 w-36 rounded" />
        </div>
      </div>
    </div>
  );
}

export function AgentsFiltersSkeleton() {
  return (
    <div className="bg-card border border-border/70 rounded-xl p-3 sm:p-4 space-y-3">
      {/* Category Tabs Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border/60">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <Skeleton className="h-7 w-28 rounded-lg" />
          <Skeleton className="h-7 w-36 rounded-lg" />
          <Skeleton className="h-7 w-36 rounded-lg" />
          <Skeleton className="h-7 w-36 rounded-lg" />
        </div>
      </div>

      {/* Main Filter Controls Grid: 2 cols on mobile, 3 on md, 6 on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-14 rounded" />
            <Skeleton className="h-8.5 w-full rounded-md" />
          </div>
        ))}
      </div>

      {/* Bottom Action Bar Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
        <Skeleton className="h-4 w-40 rounded" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-7.5 w-28 rounded-md" />
          <Skeleton className="h-7.5 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function AgentsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="border border-border/70 rounded-xl overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-muted/40 border-b border-border/70">
            <tr>
              <th className="py-2.5 px-3 w-32">
                <Skeleton className="h-3.5 w-16 rounded" />
              </th>
              <th className="py-2.5 px-3 min-w-[200px]">
                <Skeleton className="h-3.5 w-32 rounded" />
              </th>
              <th className="py-2.5 px-3 min-w-[180px]">
                <Skeleton className="h-3.5 w-28 rounded" />
              </th>
              <th className="py-2.5 px-3 hidden md:table-cell min-w-[160px]">
                <Skeleton className="h-3.5 w-24 rounded" />
              </th>
              <th className="py-2.5 px-3 hidden sm:table-cell">
                <Skeleton className="h-3.5 w-16 rounded" />
              </th>
              <th className="py-2.5 px-3 hidden lg:table-cell">
                <Skeleton className="h-3.5 w-24 rounded" />
              </th>
              <th className="py-2.5 px-3 text-right w-24">
                <Skeleton className="h-3.5 w-12 ml-auto rounded" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {/* PU Code */}
                <td className="py-3 px-3">
                  <Skeleton className="h-5 w-20 rounded bg-muted/70" />
                </td>
                {/* PU Name & Location */}
                <td className="py-3 px-3 space-y-1">
                  <Skeleton className="h-3.5 w-44 rounded" />
                  <Skeleton className="h-3 w-32 rounded" />
                </td>
                {/* Agent Name & Type */}
                <td className="py-3 px-3 space-y-1">
                  <Skeleton className="h-3.5 w-36 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </td>
                {/* Sponsor */}
                <td className="py-3 px-3 hidden md:table-cell">
                  <Skeleton className="h-3.5 w-24 rounded" />
                </td>
                {/* Role */}
                <td className="py-3 px-3 hidden sm:table-cell">
                  <Skeleton className="h-5 w-24 rounded-full" />
                </td>
                {/* Contact & Status */}
                <td className="py-3 px-3 hidden lg:table-cell space-y-1">
                  <Skeleton className="h-4 w-28 rounded-full" />
                  <Skeleton className="h-3 w-20 rounded" />
                </td>
                {/* Action */}
                <td className="py-3 px-3 text-right">
                  <Skeleton className="h-6.5 w-14 ml-auto rounded-md" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Skeleton */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border/60 bg-muted/20">
        <Skeleton className="h-3.5 w-48 rounded" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-8 w-14 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function AgentsDirectorySkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <AgentsHeaderSkeleton />
      <AgentsKPISummarySkeleton />
      <AgentsFiltersSkeleton />
      <AgentsTableSkeleton rows={8} />
    </div>
  );
}
