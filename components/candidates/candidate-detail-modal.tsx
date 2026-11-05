"use client";

import React, { useSyncExternalStore } from "react";
import { CandidateData } from "@/lib/types";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { WF, Pill, officeTone } from "@/components/ui/wf";
import { toTitleCase } from "./candidates-filters";
import { coverageTier, CHANNEL_PILL, deputyTitle, coverageText } from "./candidate-pills";

interface CandidateDetailModalProps {
  candidate: CandidateData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The seat's state name, if any (national seats have none). */
  stateName?: string | null;
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
    <>
      <dt className="text-[#737373]">{label}</dt>
      <dd className="m-0 min-w-0">{children}</dd>
    </>
  );
}

const DL = "m-0 grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px] text-[#0A0A0A]";

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
  const channel = CHANNEL_PILL[candidate.telegramStatus] ?? CHANNEL_PILL.not_matched;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-white p-5 text-[#0A0A0A]">
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 flex-col gap-1.5">
          <Pill tone={officeTone(candidate.office)}>{candidate.office}</Pill>
          <Title className="m-0 text-[18px] font-bold text-[#0A0A0A]">{toTitleCase(candidate.name)}</Title>
          {candidate.deputyName ? (
            <Description className="m-0 text-[13px] text-[#737373]">
              ({deputyTitle(candidate.office)}) {toTitleCase(candidate.deputyName)}
            </Description>
          ) : null}
        </span>
        <button type="button" onClick={onClose} className={`${WF.btnRow} min-h-8 flex-none`}>
          Close
        </button>
      </div>

      <dl className={DL}>
        <Row label="Seat">
          <span className="font-semibold">{toTitleCase(candidate.seat)}</span>
        </Row>
        <Row label="State">{stateName ? toTitleCase(stateName) : "Nigeria"}</Row>
        <Row label="Official coverage">
          {candidate.isOffCycle ? (
            <Pill tone="amber">Off-cycle: not on the next election day</Pill>
          ) : (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <span className="tabular-nums">{coverageText(candidate)}</span>
              <Pill tone={tier.tone}>{tier.label}</Pill>
            </span>
          )}
        </Row>
        <Row label="Extra agents">
          <span className="text-[#6D28D9]">+{candidate.extraAgentsCount.toLocaleString()} extra agents of their own</span>
        </Row>
        <Row label="Source">
          <span className="text-[#525252]">INEC 2027 final list (name and seat)</span>
        </Row>
      </dl>

      <div className="flex flex-col gap-2.5 border-t border-[#F0F0F0] pt-3">
        <span className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#737373]">Contact and channel</span>
        <dl className={DL}>
          <Row label="Phone">{candidate.phoneMasked ?? "Not on file"}</Row>
          <Row label="Email">Not on file</Row>
          <Row label="Channel">
            <Pill tone={channel.tone}>{channel.label}</Pill>
          </Row>
          <Row label="Notes">
            <span className="text-[#525252]">None</span>
          </Row>
        </dl>
        <span className="text-[11px] text-[#737373]">Read-only. Only Admin can edit candidate details.</span>
      </div>

      {/* Both actions are not built yet. */}
      <div className="mt-auto flex flex-wrap gap-2 border-t border-[#F0F0F0] pt-3">
        <button type="button" disabled title="Not available yet" className={WF.btnDark}>
          View as this candidate
        </button>
        <button type="button" disabled title="Not available yet" className={WF.btnOutline}>
          Agents in this seat
        </button>
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
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-[440px] max-w-full gap-0 border-l border-[#E5E5E5] p-0 shadow-[-8px_0_24px_rgba(0,0,0,0.08)] sm:max-w-[440px]"
        >
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
      <DialogContent showCloseButton={false} className="max-h-[90vh] gap-0 overflow-hidden rounded-[14px] p-0">
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
