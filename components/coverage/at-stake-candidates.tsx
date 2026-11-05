"use client";

import { useCandidateCoverage } from "@/lib/hooks/use-coverage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toTitleCase } from "@/components/candidates/candidates-filters";

interface AtStakeCandidatesProps {
  stateId: number | null;
  lgaId: number | null;
  wardId: number | null;
  officeId?: number | null;
  areaName?: string;
}

function getOfficeBadgeColor(office: string) {
  const name = office.toLowerCase();
  if (name.includes("president")) {
    return "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300";
  }
  if (name.includes("governor")) {
    return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
  }
  if (name.includes("senat")) {
    return "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300";
  }
  if (name.includes("representative")) {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
  }
  if (name.includes("assembly")) {
    return "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300";
  }
  return "bg-muted text-muted-foreground";
}

function getDeputyTitle(office: string) {
  const name = office.toLowerCase();
  if (name.includes("president")) return "Vice-President";
  if (name.includes("governor")) return "Deputy Governor";
  return "Deputy";
}

export function AtStakeCandidates({
  stateId,
  lgaId,
  wardId,
  officeId = null,
  areaName,
}: AtStakeCandidatesProps) {
  // With no area picked, only the national seat (President) is at stake.
  const isNational = !stateId && !lgaId && !wardId;
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
    officeId,
    nationalOnly: isNational && !officeId,
  });

  const candidates = data?.pages.flatMap((page) => page.items) ?? [];
  const totalRaces = data?.pages[0]?.total ?? candidates.length;
  const areaLabel = isNational ? "All of Nigeria" : areaName;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            At Stake Here
          </h3>
          {areaLabel ? (
            <Badge
              variant="outline"
              className="rounded-full text-[11px] px-2.5 py-0.5 font-medium max-w-48"
            >
              <span className="truncate">{areaLabel}</span>
            </Badge>
          ) : null}
          {data ? (
            <Badge
              variant="secondary"
              className="rounded-full text-[11px] px-2.5 py-0.5 font-normal text-muted-foreground"
            >
              {totalRaces.toLocaleString()} NDC candidate{totalRaces === 1 ? "" : "s"} ·{" "}
              {totalRaces.toLocaleString()} seat{totalRaces === 1 ? "" : "s"}
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
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {Array.from({ length: isNational ? 1 : 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="border border-border/60 bg-card rounded-xl p-4 flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            Couldn&apos;t load candidate coverage.
          </span>
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
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 transition-opacity ${
            isFetching ? "opacity-60" : ""
          }`}
        >
          {candidates.map((cand) => (
            <div
              key={cand.id}
              className="border border-border/70 bg-card rounded-2xl p-4 shadow-none hover:border-primary/40 transition-colors flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${getOfficeBadgeColor(cand.office)}`}
                >
                  {cand.office}
                </span>
                <span
                  className="text-[10px] uppercase tracking-wide text-muted-foreground truncate"
                  title={cand.seat}
                >
                  {cand.seat}
                </span>
              </div>

              <div>
                <div className="font-semibold text-sm text-foreground leading-tight">
                  {toTitleCase(cand.name)}
                </div>
                {cand.deputyName && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    ({getDeputyTitle(cand.office)}) {toTitleCase(cand.deputyName)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground/80">Official coverage</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {cand.coveragePct}%
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Official coverage"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={cand.coveragePct}
                  className="h-1 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, cand.coveragePct))}%` }}
                  />
                </div>
                <div className="flex items-start justify-between gap-3 text-[11px]">
                  <span className="text-muted-foreground">
                    {cand.coveredPUs.toLocaleString()} of {cand.totalPUs.toLocaleString()} (
                    {cand.coveragePct}%)
                  </span>
                  <span className="text-purple-600 dark:text-purple-400 font-medium">
                    +{cand.extraAgentsCount.toLocaleString()} extra agents of their own
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

      {isNational && !officeId ? (
        <p className="text-[11px] text-muted-foreground">
          Pick a state to see its governor, senators, House of Reps and State Assembly seats.
        </p>
      ) : null}
    </div>
  );
}
