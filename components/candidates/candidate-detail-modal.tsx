"use client";

import React, { useSyncExternalStore } from "react";
import { CandidateData } from "@/lib/types";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toTitleCase } from "./candidates-filters";

interface CandidateDetailModalProps {
  candidate: CandidateData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The seat's state name, if any (national seats have none). */
  stateName?: string | null;
}

const OFFICE_BADGE: Record<string, string> = {
  President: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300",
  Governor: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  Senate: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  "House of Reps": "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300",
  "State Assembly": "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
};

const CHANNEL_BADGE: Record<CandidateData["telegramStatus"], { label: string; className: string }> = {
  connected: { label: "Connected", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  sms_only: { label: "Invited", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  not_matched: { label: "Not connected", className: "bg-muted text-muted-foreground" },
};

function coverageTier(cand: CandidateData) {
  if (cand.totalPUs <= 0) return { label: "Not mapped", className: "bg-muted text-muted-foreground" };
  if (cand.coveragePct >= 50) {
    return { label: "High", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" };
  }
  if (cand.coveragePct >= 30) {
    return { label: "Medium", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" };
  }
  return { label: "Critical", className: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" };
}

// Side panel from the sm breakpoint up; a centred modal on phones.
const DESKTOP_QUERY = "(min-width: 640px)";
function subscribe(callback: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
function useIsDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-xs text-foreground">{children}</dd>
    </div>
  );
}

const PILL = "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium";

function CandidateDetailBody({
  candidate,
  stateName,
  onClose,
  Title,
  Description,
}: {
  candidate: CandidateData;
  stateName?: string | null;
  onClose: () => void;
  Title: typeof DialogTitle | typeof SheetTitle;
  Description: typeof DialogDescription | typeof SheetDescription;
}) {
  const tier = coverageTier(candidate);
  const channel = CHANNEL_BADGE[candidate.telegramStatus] ?? CHANNEL_BADGE.not_matched;
  const deputyTitle = candidate.office === "President" ? "Vice-President" : "Deputy";

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <span className={`${PILL} ${OFFICE_BADGE[candidate.office] ?? "bg-muted text-muted-foreground"}`}>
              {candidate.office}
            </span>
            <Title className="text-lg font-bold leading-tight text-foreground">
              {toTitleCase(candidate.name)}
            </Title>
            {candidate.deputyName && (
              <Description className="text-xs text-muted-foreground">
                ({deputyTitle}) {toTitleCase(candidate.deputyName)}
              </Description>
            )}
          </div>
          <Button variant="outline" size="sm" className="h-8 shrink-0 px-3 text-xs" onClick={onClose}>
            Close
          </Button>
        </div>

        {/* Seat and coverage */}
        <dl>
          <Row label="Seat">
            <span className="font-semibold">{toTitleCase(candidate.seat)}</span>
          </Row>
          <Row label="State">{stateName ? toTitleCase(stateName) : "—"}</Row>
          <Row label="Official coverage">
            {candidate.isOffCycle ? (
              <span className={`${PILL} bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300`}>
                Off-cycle: not on the next election day
              </span>
            ) : (
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="tabular-nums">
                  {candidate.totalPUs > 0
                    ? `${candidate.coveredPUs.toLocaleString()} of ${candidate.totalPUs.toLocaleString()} (${candidate.coveragePct}%)`
                    : "No units mapped"}
                </span>
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${tier.className}`}>
                  {tier.label}
                </span>
              </span>
            )}
          </Row>
          <Row label="Extra agents">
            <span className="text-purple-600 dark:text-purple-400">
              +{candidate.extraAgentsCount.toLocaleString()} extra agents of their own
            </span>
          </Row>
          <Row label="Source">INEC 2027 final list (name and seat)</Row>
        </dl>

        {/* Contact and channel */}
        <div className="space-y-1 border-t border-border/70 pt-4">
          <div className="pb-1">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Contact and channel
            </h3>
          </div>
          <dl>
            <Row label="Phone">{candidate.phoneMasked ?? "Not on file"}</Row>
            <Row label="Email">Not on file</Row>
            <Row label="Channel">
              <span className={`${PILL} ${channel.className}`}>{channel.label}</span>
            </Row>
            <Row label="Notes">None</Row>
          </dl>
          <p className="pt-1 text-[11px] text-muted-foreground">
            Read-only. Only Admin can edit candidate details.
          </p>
        </div>
      </div>

      {/* Footer actions (both features are not built yet) */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border/70 p-5">
        <Button
          disabled
          title="Not available yet"
          className="h-9 bg-foreground px-4 text-xs text-background hover:bg-foreground/90"
        >
          View as this candidate
        </Button>
        <Button variant="outline" disabled title="Not available yet" className="h-9 px-4 text-xs">
          Agents in this seat
        </Button>
      </div>
    </div>
  );
}

export function CandidateDetailModal({ candidate, open, onOpenChange, stateName }: CandidateDetailModalProps) {
  const isDesktop = useIsDesktop();
  if (!candidate) return null;

  const close = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" showCloseButton={false} className="gap-0 p-0 sm:max-w-md">
          <CandidateDetailBody
            candidate={candidate}
            stateName={stateName}
            onClose={close}
            Title={SheetTitle}
            Description={SheetDescription}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-h-[90vh] gap-0 overflow-hidden p-0">
        <CandidateDetailBody
          candidate={candidate}
          stateName={stateName}
          onClose={close}
          Title={DialogTitle}
          Description={DialogDescription}
        />
      </DialogContent>
    </Dialog>
  );
}
