"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function BroadcastsKPISummarySkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div
          key={idx}
          className={`bg-card border border-border/70 rounded-xl p-3.5 sm:p-4 space-y-2.5 ${
            idx === 4 ? "col-span-2 sm:col-span-1" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-7 w-7 rounded-lg" />
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <Skeleton className="h-7 w-16 sm:w-20 rounded" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
          <Skeleton className="h-3 w-32 rounded" />
        </div>
      ))}
    </div>
  );
}

export function BroadcastCardSkeleton() {
  return (
    <div className="border border-border/70 rounded-xl bg-card p-4 sm:p-5 space-y-3.5">
      {/* Top Header: Badges & Timestamp */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20 rounded hidden sm:inline-block" />
          <Skeleton className="h-6 w-6 rounded-md" />
        </div>
      </div>

      {/* Campaign Title & Target Area */}
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-3/4 max-w-md rounded" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-24 rounded" />
          <Skeleton className="h-3.5 w-3.5 rounded-full" />
          <Skeleton className="h-3.5 w-44 rounded" />
        </div>
      </div>

      {/* Message Preview Snippet */}
      <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50 space-y-1.5">
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-4/5 rounded" />
      </div>

      {/* Delivery Performance Bar Skeleton */}
      <div className="space-y-2 pt-1 border-t border-border/60">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3.5 w-44 rounded" />
          <Skeleton className="h-3.5 w-32 rounded" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </div>
  );
}

export function BroadcastsCardsListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {Array.from({ length: count }).map((_, idx) => (
        <BroadcastCardSkeleton key={idx} />
      ))}
    </div>
  );
}

export function BroadcastsTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold text-[11px]">
            <tr>
              <th className="py-3 px-4">Campaign Title & Target</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Sender & Channel</th>
              <th className="py-3 px-3">Audience</th>
              <th className="py-3 px-3">Timestamp</th>
              <th className="py-3 px-4">Delivery Rate</th>
              <th className="py-3 px-3">Acknowledged</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {Array.from({ length: rows }).map((_, idx) => (
              <tr key={idx} className="p-3">
                <td className="py-3.5 px-4 space-y-1">
                  <Skeleton className="h-4 w-48 rounded" />
                  <Skeleton className="h-3 w-32 rounded" />
                </td>
                <td className="py-3.5 px-3">
                  <Skeleton className="h-5 w-24 rounded-full" />
                </td>
                <td className="py-3.5 px-3 space-y-1">
                  <Skeleton className="h-4 w-28 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </td>
                <td className="py-3.5 px-3">
                  <Skeleton className="h-4 w-16 rounded" />
                </td>
                <td className="py-3.5 px-3">
                  <Skeleton className="h-3.5 w-24 rounded" />
                </td>
                <td className="py-3.5 px-4 space-y-1">
                  <Skeleton className="h-3.5 w-20 rounded" />
                  <Skeleton className="h-1.5 w-28 rounded-full" />
                </td>
                <td className="py-3.5 px-3">
                  <Skeleton className="h-3.5 w-16 rounded" />
                </td>
                <td className="py-3.5 px-4 text-right">
                  <div className="flex justify-end gap-1.5">
                    <Skeleton className="h-7 w-16 rounded-md" />
                    <Skeleton className="h-7 w-7 rounded-md" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
