"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function AudiencePreviewSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-28 rounded" />
        </div>
        <Skeleton className="h-6 w-32 rounded" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/70 bg-background p-2.5 space-y-1.5">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-5 w-12 rounded" />
        </div>
        <div className="rounded-lg border border-border/70 bg-background p-2.5 space-y-1.5">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-5 w-12 rounded" />
        </div>
      </div>
    </div>
  );
}

export function GeographicScopeDropdownSkeleton() {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-3.5 w-16 rounded" />
      <Skeleton className="h-9 w-full rounded-md" />
    </div>
  );
}

export function ComposeBroadcastSkeleton() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-md" />
            <Skeleton className="h-7 w-60 rounded-md" />
          </div>
          <Skeleton className="h-4 w-80 rounded-md" />
        </div>
        <Skeleton className="h-6 w-36 rounded-full" />
      </div>

      {/* Step Tabs Skeleton */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card p-3"
          >
            <Skeleton className="h-6 w-6 rounded-full shrink-0" />
            <div className="space-y-1 min-w-0 flex-1">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-2.5 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form Area Skeleton */}
        <div className="space-y-6 lg:col-span-7">
          <div className="border border-border/70 rounded-xl bg-card p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-40 rounded" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          </div>

          <div className="border border-border/70 rounded-xl bg-card p-4 sm:p-5 space-y-4">
            <Skeleton className="h-5 w-44 rounded" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <GeographicScopeDropdownSkeleton />
              <GeographicScopeDropdownSkeleton />
              <GeographicScopeDropdownSkeleton />
            </div>
          </div>

          <AudiencePreviewSkeleton />
        </div>

        {/* Right Preview Area Skeleton */}
        <div className="lg:col-span-5 space-y-4">
          <div className="border border-border/70 rounded-xl bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
