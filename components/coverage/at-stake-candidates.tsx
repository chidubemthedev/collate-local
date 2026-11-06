"use client";

import { Loader2 } from "lucide-react";
import { useCandidateCoverage } from "@/lib/hooks/use-coverage";
import { toTitleCase } from "@/components/candidates/candidates-filters";
import { WF, Pill, Bar, officeTone } from "@/components/ui/wf";

interface AtStakeCandidatesProps {
  stateId: number | null;
  lgaId: number | null;
  wardId: number | null;
  officeId?: number | null;
  areaName?: string;
}

function getDeputyTitle(office: string) {
  const name = office.toLowerCase();
  if (name.includes("president")) return "Vice-President";
  if (name.includes("governor")) return "Deputy Governor";
  return "Deputy";
}

const GRID = "grid grid-cols-1 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] sm:gap-3";

export function AtStakeCandidates({
  stateId,
  lgaId,
  wardId,
  officeId = null,
  areaName,
}: AtStakeCandidatesProps) {
  // With no area picked, only the national seat (President) is at stake.
  const isNational = !stateId && !lgaId && !wardId;
  const { data, isPending, isError, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useCandidateCoverage({
      stateId,
      lgaId,
      wardId,
      officeId,
      nationalOnly: isNational && !officeId,
    });

  const candidates = data?.pages.flatMap((page) => page.items) ?? [];
  const totalRaces = data?.pages[0]?.total ?? candidates.length;
  const areaLabel = isNational ? "All of Nigeria" : areaName ? toTitleCase(areaName) : undefined;
  const refreshing = isFetching && !isFetchingNextPage && !isPending;

  return (
    <section aria-label="At stake here" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <span className={WF.sectionTitle}>At Stake Here</span>
          {areaLabel ? <span className={WF.scopeChip}>{areaLabel}</span> : null}
          {data ? (
            <span className={WF.greyChip}>
              {totalRaces.toLocaleString()} NDC candidate{totalRaces === 1 ? "" : "s"} · {totalRaces.toLocaleString()} seat
              {totalRaces === 1 ? "" : "s"}
            </span>
          ) : null}
        </span>
        <span className="text-[12px] text-[#737373]">Official coverage rule: 1 official agent = covered</span>
      </div>

      {isPending ? (
        <div className={`${WF.card} flex items-center justify-center py-10`} aria-busy="true">
          <Loader2 className="h-5 w-5 animate-spin text-[#737373]" aria-label="Loading candidates" />
        </div>
      ) : isError ? (
        <div className={`${WF.card} flex items-center justify-between gap-3 p-3.5`}>
          <span className="text-[13px] text-[#737373]">Couldn&apos;t load candidate coverage.</span>
          <button type="button" className={WF.btnOutline} onClick={() => refetch()}>
            Retry
          </button>
        </div>
      ) : candidates.length === 0 ? (
        <p className="m-0 text-[12px] text-[#737373]">No candidates have seats in this area.</p>
      ) : (
        <div className="relative">
          {refreshing ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[#737373]" aria-label="Loading" />
            </div>
          ) : null}
          <div className={`${GRID} transition-opacity ${refreshing ? "opacity-50" : ""}`}>
            {candidates.map((cand) => (
              <div key={cand.id} className="flex min-w-0 flex-col gap-1.5 rounded-[14px] border border-[#E5E5E5] bg-white p-3.5">
                <span className="flex items-start justify-between gap-2">
                  <Pill tone={officeTone(cand.office)}>{cand.office}</Pill>
                  <span className="max-w-[62%] text-right text-[11px] leading-[14px] text-[#737373] uppercase" title={cand.seat}>
                    {cand.seat}
                  </span>
                </span>
                <span className="text-[14px] font-semibold text-[#0A0A0A]">{toTitleCase(cand.name)}</span>
                {cand.deputyName ? (
                  <span className="text-[11px] text-[#737373]">
                    ({getDeputyTitle(cand.office)}) {toTitleCase(cand.deputyName)}
                  </span>
                ) : null}
                <span className="mt-auto flex justify-between gap-2 pt-1 text-[12px]">
                  <span className="text-[#525252]">Official coverage</span>
                  <span className="font-bold text-[#1E8A55]">{cand.coveragePct}%</span>
                </span>
                <Bar pct={cand.coveragePct} />
                <span className="flex justify-between gap-2 text-[11px] tabular-nums">
                  <span className="text-[#737373]">
                    {cand.coveredPUs.toLocaleString()} of {cand.totalPUs.toLocaleString()} ({cand.coveragePct}%)
                  </span>
                  <span className="text-right text-[#6D28D9]">
                    +{cand.extraAgentsCount.toLocaleString()} extra agents of their own
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasNextPage ? (
        <button
          type="button"
          className={`${WF.btnOutline} self-center px-3.5`}
          disabled={isFetchingNextPage}
          onClick={() => fetchNextPage()}
        >
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      ) : null}

      {isNational && !officeId ? (
        <p className={WF.note}>Pick a state to see its governor, senators, House of Reps and State Assembly seats.</p>
      ) : null}
    </section>
  );
}
