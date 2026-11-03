"use client";

import React from "react";
import { useCandidateCoverage } from "@/lib/hooks/use-coverage";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, UserCheck } from "lucide-react";

interface AtStakeCandidatesProps {
  stateId: number | null;
  lgaId: number | null;
  wardId: number | null;
}

function getOfficeBadgeColor(office: string) {
  const name = office.toLowerCase();
  if (name.includes("president")) {
    return "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800";
  }
  if (name.includes("governor")) {
    return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800";
  }
  if (name.includes("senat")) {
    return "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800";
  }
  if (name.includes("representative")) {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
  }
  if (name.includes("assembly")) {
    return "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800";
  }
  return "bg-muted text-muted-foreground";
}

export function AtStakeCandidates({ stateId, lgaId, wardId }: AtStakeCandidatesProps) {
  const {
    data,
    isPending,
    isError,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useCandidateCoverage({
    stateId,
    lgaId,
    wardId,
  });

  const candidates = data?.pages.flatMap((page) => page.items) ?? [];
  const totalRaces = data?.pages[0]?.total ?? candidates.length;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-primary" />
            At Stake Here
          </h3>
          {data ? (
            <Badge variant="secondary" className="text-xs px-2 py-0.5 font-normal">
              {totalRaces.toLocaleString()} race{totalRaces === 1 ? "" : "s"} at this level
            </Badge>
          ) : null}
        </div>
        <span className="text-[11px] text-muted-foreground hidden sm:inline">
          Official coverage rule: 1 official agent = covered
        </span>
      </div>

      {isPending ? (
        <div
          aria-busy="true"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="border border-border/60 bg-card rounded-xl p-4 flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Couldn&apos;t load candidate coverage.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : candidates.length === 0 ? (
        <div className="border border-border/60 bg-card rounded-xl p-4 text-sm text-muted-foreground">
          No candidates have seats in this area.
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 transition-opacity ${
            isFetching ? "opacity-60" : ""
          }`}
        >
          {candidates.map((cand) => (
            <div
              key={cand.id}
              className="border border-border/60 bg-card rounded-xl p-3.5 shadow-none hover:border-primary/40 transition-colors flex flex-col justify-between space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge
                  variant="outline"
                  className={`text-[11px] font-medium ${getOfficeBadgeColor(cand.office)}`}
                >
                  {cand.office}
                </Badge>
                <span
                  className="text-[10px] text-muted-foreground font-mono truncate"
                  title={cand.seat}
                >
                  {cand.seat}
                </span>
              </div>

              <div>
                <div className="font-semibold text-sm text-foreground leading-tight">{cand.name}</div>
                {cand.deputyName && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Running mate:{" "}
                    <span className="text-foreground/90 font-medium">{cand.deputyName}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 pt-1 border-t border-border/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Shield className="w-3 h-3 text-emerald-600" />
                    Official coverage
                  </span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    {cand.coveragePct}%
                  </span>
                </div>
                <Progress
                  value={cand.coveragePct}
                  className="h-1.5 bg-emerald-100 dark:bg-emerald-950/40"
                />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    {cand.coveredPUs.toLocaleString()} / {cand.totalPUs.toLocaleString()} PUs
                  </span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                    +{cand.extraAgentsCount.toLocaleString()} extra agents
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasNextPage ? (
        <div className="flex justify-center pt-1">
          <Button
            variant="outline"
            size="sm"
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
