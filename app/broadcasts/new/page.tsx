"use client";

import React, { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePermissions, useSession } from "@/lib/hooks/use-auth";
import {
  useGeographyLgas,
  useGeographyPollingUnits,
  useGeographyStates,
  useGeographyWards,
} from "@/lib/hooks/use-geography";
import { useAudiencePreview, useCreateBroadcast } from "@/lib/hooks/use-broadcasts";
import { useOwnerGroups } from "@/lib/hooks/use-groups";
import { ApiClientError } from "@/lib/api/client";
import type { AudienceFilter, CreateBroadcastInput } from "@/types/api";
import { toTitleCase } from "@/components/candidates/candidates-filters";
import { Input } from "@/components/ui/input";
import { WF, PageHeader, LoadingBox } from "@/components/ui/wf";
import { Textarea } from "@/components/ui/textarea";
import { FieldSpinner } from "@/components/ui/field-spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Loader2 } from "lucide-react";

type Section = "to" | "message" | "time";

const MESSAGE_LIMIT = 1000; // the API's maximum
const MAX_SCHEDULE_DAYS = 90; // the API's maximum

// The current time, as an external store refreshed every 30 seconds. Reading the clock in
// render is impure and Next.js rejects it during prerendering, so the build sees 0
// ("not known yet") and the browser reads the real clock once it subscribes.
let clockNow = 0;
function subscribeClock(onChange: () => void): () => void {
  clockNow = Date.now();
  onChange();
  const timer = setInterval(() => {
    clockNow = Date.now();
    onChange();
  }, 30_000);
  return () => clearInterval(timer);
}
const getClockSnapshot = () => clockNow;
const getServerClockSnapshot = () => 0;

const LABEL_CLASS = `${WF.label} flex items-center gap-1.5 truncate`;
const TRIGGER_CLASS = "w-full";

function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return "Your session has expired. Sign in again to continue.";
    if (error.status === 403) return "You do not have permission to send this broadcast.";
    return error.message;
  }
  return "The request failed. Please try again.";
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** A part of the form: a tick when ready, a summary when closed, the fields when open. */
function SectionCard({
  title,
  summary,
  ready,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  ready: boolean;
  open: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col rounded-[14px] border bg-white p-3.5 sm:px-[18px] sm:py-4 ${
        open ? "border-[#A3A3A3]" : "border-[#E5E5E5]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-start gap-3">
          <span
            aria-label={ready ? "Ready" : "Not ready yet"}
            className={`box-border flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full text-[12px] font-bold ${
              ready ? "bg-[#22A06B] text-white" : "border-2 border-[#D4D4D4] bg-white text-transparent"
            }`}
          >
            ✓
          </span>
          <span className="flex min-w-0 flex-col gap-[3px]">
            <span className="text-[15px] font-bold text-[#0A0A0A]">{title}</span>
            <span className="line-clamp-2 text-[13px] text-[#525252]">{summary}</span>
          </span>
        </span>
        {onToggle && (
          <button type="button" aria-expanded={open} className={WF.btnOutline} onClick={onToggle}>
            {open ? "Done" : ready ? "Edit" : "Add"}
          </button>
        )}
      </div>
      {open && children && (
        <div className="mt-3.5 flex flex-col gap-3 border-t border-[#F0F0F0] pt-3.5">{children}</div>
      )}
    </div>
  );
}

export default function NewBroadcastPage() {
  const router = useRouter();
  const { data: permissions, isLoading: isLoadingPermissions, error: permissionsError } = usePermissions();
  const { data: session } = useSession();

  const [openSection, setOpenSection] = useState<Section | null>("to");
  const toggle = (section: Section) => setOpenSection((current) => (current === section ? null : section));

  // To
  const [includeOfficial, setIncludeOfficial] = useState(true);
  const [includeExtra, setIncludeExtra] = useState(true);
  const [stateId, setStateId] = useState<number | null>(null);
  const [lgaId, setLgaId] = useState<number | null>(null);
  const [wardId, setWardId] = useState<number | null>(null);
  const [pollingUnitId, setPollingUnitId] = useState<number | null>(null);
  const [ownerGroupId, setOwnerGroupId] = useState<number | null>(null);

  // Message
  const [messageText, setMessageText] = useState("");

  // Send time
  const [timing, setTiming] = useState<"now" | "scheduled">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  // The current time in ms, or 0 before the browser has read the clock.
  const now = useSyncExternalStore(subscribeClock, getClockSnapshot, getServerClockSnapshot);

  const statesQuery = useGeographyStates();
  const lgasQuery = useGeographyLgas(stateId);
  const wardsQuery = useGeographyWards(lgaId);
  const pollingUnitsQuery = useGeographyPollingUnits(wardId);
  const groupsQuery = useOwnerGroups();

  const states = useMemo(() => statesQuery.data ?? [], [statesQuery.data]);
  const lgas = useMemo(() => (stateId === null ? [] : lgasQuery.data ?? []), [stateId, lgasQuery.data]);
  const wards = useMemo(() => (lgaId === null ? [] : wardsQuery.data ?? []), [lgaId, wardsQuery.data]);
  const pollingUnits = useMemo(
    () => (wardId === null ? [] : pollingUnitsQuery.data ?? []),
    [wardId, pollingUnitsQuery.data],
  );
  const groups = groupsQuery.data ?? [];

  const lgasBusy = stateId !== null && lgasQuery.isFetching;
  const wardsBusy = lgaId !== null && wardsQuery.isFetching;
  const pollingUnitsBusy = wardId !== null && pollingUnitsQuery.isFetching;

  // The owner filter applies to every agent it matches, so it is only offered for extras alone.
  const ownerFilterAvailable = includeExtra && !includeOfficial;
  const effectiveOwnerGroupId = ownerFilterAvailable ? ownerGroupId : null;
  const agentKind: AudienceFilter["agentKind"] =
    includeOfficial && includeExtra ? "all" : includeOfficial ? "official" : "extra";
  const hasWho = includeOfficial || includeExtra;

  const audienceFilter = useMemo<AudienceFilter>(() => {
    const filter: AudienceFilter = { agentKind };
    if (stateId !== null) filter.stateId = stateId;
    if (lgaId !== null) filter.lgaId = lgaId;
    if (wardId !== null) filter.wardId = wardId;
    if (pollingUnitId !== null) filter.pollingUnitId = pollingUnitId;
    if (effectiveOwnerGroupId !== null) filter.ownerGroupId = effectiveOwnerGroupId;
    return filter;
  }, [agentKind, stateId, lgaId, wardId, pollingUnitId, effectiveOwnerGroupId]);

  const previewQuery = useAudiencePreview(audienceFilter, {
    enabled: Boolean(permissions?.canBroadcast) && hasWho,
  });
  const createBroadcast = useCreateBroadcast();

  const officialCount = includeOfficial ? previewQuery.data?.officialCount ?? 0 : 0;
  const extraCount = includeExtra ? previewQuery.data?.extraCount ?? 0 : 0;
  const totalRecipients = officialCount + extraCount;
  const previewLoading = hasWho && previewQuery.isFetching;

  const areaLabel = useMemo(() => {
    const state = states.find((item) => item.id === stateId);
    const lga = lgas.find((item) => item.id === lgaId);
    const ward = wards.find((item) => item.id === wardId);
    const pollingUnit = pollingUnits.find((item) => item.id === pollingUnitId);
    const parts: string[] = [];
    if (pollingUnit) parts.push(`${pollingUnit.code} · ${toTitleCase(pollingUnit.name)}`);
    if (ward) parts.push(`${toTitleCase(ward.name)} ward`);
    if (lga) parts.push(`${toTitleCase(lga.name)} LGA`);
    if (state) parts.push(toTitleCase(state.name));
    return parts.length > 0 ? parts.join(", ") : "Everywhere you can reach";
  }, [states, lgas, wards, pollingUnits, stateId, lgaId, wardId, pollingUnitId]);

  const peopleLabel = `${totalRecipients.toLocaleString()} ${totalRecipients === 1 ? "person" : "people"}`;

  // Readiness of each part
  const toReady = hasWho && !previewQuery.isError && !previewLoading && totalRecipients > 0;
  const trimmedMessage = messageText.trim();
  const messageReady = trimmedMessage.length > 0 && trimmedMessage.length <= MESSAGE_LIMIT;

  const scheduleCheck = useMemo((): { ok: boolean; at?: Date; error?: string } => {
    if (timing === "now") return { ok: true };
    if (!scheduledDate || !scheduledTime) return { ok: false };
    // The clock is not known yet (first moment after load): wait rather than show an error.
    if (now === 0) return { ok: false };
    const at = new Date(`${scheduledDate}T${scheduledTime}`);
    if (Number.isNaN(at.getTime()) || at.getTime() <= now) {
      return { ok: false, error: "Pick a time in the future." };
    }
    if (at.getTime() > now + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000) {
      return { ok: false, error: `Pick a time within the next ${MAX_SCHEDULE_DAYS} days.` };
    }
    return { ok: true, at };
  }, [timing, scheduledDate, scheduledTime, now]);
  const timeReady = scheduleCheck.ok;

  const canSend = toReady && messageReady && timeReady && !createBroadcast.isPending;

  const handleSend = () => {
    if (!canSend) return;
    const payload: CreateBroadcastInput = {
      audienceFilter,
      messageText: trimmedMessage,
      ...(scheduleCheck.at ? { scheduledSendAt: scheduleCheck.at.toISOString() } : {}),
    };
    createBroadcast.mutate(payload, {
      onSuccess: (created) => router.push(`/broadcasts/${created.id}`),
    });
  };

  if (isLoadingPermissions) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="New broadcast" subtitle="Loading…" />
        <LoadingBox>Loading…</LoadingBox>
      </div>
    );
  }

  if (permissionsError) {
    return (
      <div role="alert" className={`${WF.card} mx-auto mt-12 max-w-xl space-y-3 p-6 text-center`}>
        <p className="text-[13px] text-[#B42318]">{getApiErrorMessage(permissionsError)}</p>
        <Link href="/login" className="text-[12px] font-semibold text-[#0A0A0A] underline">
          Return to sign in
        </Link>
      </div>
    );
  }

  if (!permissions?.canBroadcast) {
    return (
      <div role="alert" className={`${WF.card} mx-auto mt-12 max-w-xl p-6 text-center`}>
        <p className="text-[14px] font-semibold">Broadcast access required</p>
        <p className="mt-1 text-[12px] text-[#737373]">
          Your account does not have permission to create broadcasts.
        </p>
      </div>
    );
  }

  const toSummary = !hasWho
    ? "Pick who should get it"
    : previewQuery.isError
      ? "Couldn't count the audience"
      : previewQuery.data === undefined
        ? "Counting…"
        : `${peopleLabel} · ${areaLabel}`;

  const messageSummary = trimmedMessage ? trimmedMessage : "Write the message";
  const timeSummary =
    timing === "now"
      ? "Send as soon as you press Send"
      : scheduleCheck.at
        ? `Send on ${scheduleCheck.at.toLocaleString(undefined, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}`
        : scheduleCheck.error ?? "Pick a date and time";
  const bubbleTime = scheduleCheck.at
    ? formatClock(scheduleCheck.at)
    : now > 0
      ? formatClock(new Date(now))
      : "";

  const chip = (active: boolean) =>
    `min-h-[30px] rounded-full border px-3 text-[12px] font-semibold transition-colors ${
      active ? "border-[#171717] bg-[#171717] text-[#FAFAFA]" : "border-[#E5E5E5] bg-white text-[#0A0A0A] hover:bg-[#FAFAFA]"
    }`;
  const fromName = session?.person?.fullName ?? "You";

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 text-[#0A0A0A] sm:gap-4">
      <PageHeader title="New broadcast" subtitle="Fill in each part; it ticks green when it is ready to send" />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
        {/* Form */}
        <section aria-label="Broadcast checklist" className="flex min-w-0 flex-1 flex-col gap-3">
          <SectionCard
            title="To"
            summary={toSummary}
            ready={toReady}
            open={openSection === "to"}
            onToggle={() => toggle("to")}
          >
            <div className="flex flex-col gap-2">
              <div className={LABEL_CLASS}>Who</div>
              <div role="group" aria-label="Who" className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  aria-pressed={includeOfficial}
                  onClick={() => setIncludeOfficial((value) => !value)}
                  className={chip(includeOfficial)}
                >
                  Official agents
                </button>
                <button
                  type="button"
                  aria-pressed={includeExtra}
                  onClick={() => setIncludeExtra((value) => !value)}
                  className={chip(includeExtra)}
                >
                  Extra agents
                </button>
              </div>
              {!hasWho && <p className="m-0 text-[12px] text-[#B42318]">Pick at least one.</p>}
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] sm:items-end">
              <div className="flex min-w-0 flex-col gap-1">
                <label className={LABEL_CLASS}>
                  State
                  <FieldSpinner loading={statesQuery.isPending} />
                </label>
                <Select
                  value={stateId === null ? "all" : String(stateId)}
                  disabled={statesQuery.isPending}
                  onValueChange={(val) => {
                    setStateId(val && val !== "all" ? Number(val) : null);
                    setLgaId(null);
                    setWardId(null);
                    setPollingUnitId(null);
                  }}
                >
                  <SelectTrigger className={TRIGGER_CLASS}>
                    <SelectValue placeholder="All states">
                      {(val) => {
                        if (statesQuery.isPending) return "Loading states…";
                        const found = states.find((item) => String(item.id) === val);
                        return found ? `${found.code} · ${toTitleCase(found.name)}` : "All states";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All states</SelectItem>
                    {states.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.code} · {toTitleCase(item.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex min-w-0 flex-col gap-1">
                <label className={LABEL_CLASS}>
                  LGA
                  <FieldSpinner loading={lgasBusy} />
                </label>
                <Select
                  value={lgaId === null ? "all" : String(lgaId)}
                  disabled={stateId === null || lgasBusy}
                  onValueChange={(val) => {
                    setLgaId(val && val !== "all" ? Number(val) : null);
                    setWardId(null);
                    setPollingUnitId(null);
                  }}
                >
                  <SelectTrigger className={TRIGGER_CLASS}>
                    <SelectValue placeholder="All LGAs">
                      {(val) => {
                        if (lgasBusy) return "Loading LGAs…";
                        const found = lgas.find((item) => String(item.id) === val);
                        return found ? `${found.code} · ${toTitleCase(found.name)}` : "All LGAs";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All LGAs</SelectItem>
                    {lgas.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.code} · {toTitleCase(item.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex min-w-0 flex-col gap-1">
                <label className={LABEL_CLASS}>
                  Ward
                  <FieldSpinner loading={wardsBusy} />
                </label>
                <Select
                  value={wardId === null ? "all" : String(wardId)}
                  disabled={lgaId === null || wardsBusy}
                  onValueChange={(val) => {
                    setWardId(val && val !== "all" ? Number(val) : null);
                    setPollingUnitId(null);
                  }}
                >
                  <SelectTrigger className={TRIGGER_CLASS}>
                    <SelectValue placeholder="All wards">
                      {(val) => {
                        if (wardsBusy) return "Loading wards…";
                        const found = wards.find((item) => String(item.id) === val);
                        return found ? toTitleCase(found.name) : "All wards";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All wards</SelectItem>
                    {wards.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {toTitleCase(item.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex min-w-0 flex-col gap-1">
                <label className={LABEL_CLASS}>
                  Polling units
                  <FieldSpinner loading={pollingUnitsBusy} />
                </label>
                <Select
                  value={pollingUnitId === null ? "all" : String(pollingUnitId)}
                  disabled={wardId === null || pollingUnitsBusy}
                  onValueChange={(val) => setPollingUnitId(val && val !== "all" ? Number(val) : null)}
                >
                  <SelectTrigger className={TRIGGER_CLASS}>
                    <SelectValue placeholder="All polling units">
                      {(val) => {
                        if (pollingUnitsBusy) return "Loading polling units…";
                        const found = pollingUnits.find((item) => String(item.id) === val);
                        return found ? `${found.code} · ${toTitleCase(found.name)}` : "All polling units";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All polling units</SelectItem>
                    {pollingUnits.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.code} · {toTitleCase(item.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div
                className="flex min-w-0 flex-col gap-1"
                title={ownerFilterAvailable ? undefined : "Pick only Extra agents to filter by owner"}
              >
                <label className={LABEL_CLASS}>
                  Extra agents owned by
                  <FieldSpinner loading={groupsQuery.isPending} />
                </label>
                <Select
                  value={effectiveOwnerGroupId === null ? "all" : String(effectiveOwnerGroupId)}
                  disabled={!ownerFilterAvailable || groupsQuery.isPending || groupsQuery.isError}
                  onValueChange={(val) => setOwnerGroupId(val && val !== "all" ? Number(val) : null)}
                >
                  <SelectTrigger className={TRIGGER_CLASS}>
                    <SelectValue placeholder="Anyone">
                      {(val) => {
                        if (groupsQuery.isPending) return "Loading groups…";
                        return groups.find((group) => String(group.id) === val)?.name ?? "Anyone";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Anyone</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={String(group.id)}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!ownerFilterAvailable && includeExtra && (
                  <p className="m-0 text-[11px] text-[#737373]">Pick only Extra agents to filter by owner.</p>
                )}
              </div>
            </div>

            <p className="m-0 text-[12px] text-[#737373]">
              An area message reaches every agent at the polling units in it.
            </p>
            {previewQuery.isError && (
              <div role="alert" className="flex items-center gap-2 text-[12px] text-[#B42318]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{getApiErrorMessage(previewQuery.error)}</span>
                <button
                  type="button"
                  className="border-0 bg-transparent p-0 font-semibold underline"
                  onClick={() => void previewQuery.refetch()}
                >
                  Retry
                </button>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="From"
            summary={`${fromName} · Telegram + SMS fallback`}
            ready
            open={false}
          />

          <SectionCard
            title="Message"
            summary={messageSummary}
            ready={messageReady}
            open={openSection === "message"}
            onToggle={() => toggle("message")}
          >
            <div className="flex flex-col gap-1">
              <label htmlFor="broadcast-message" className={LABEL_CLASS}>Message</label>
              <Textarea
                id="broadcast-message"
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                rows={6}
                maxLength={MESSAGE_LIMIT}
                placeholder="Write what agents will read. An OK button is added for them to tap."
                className="rounded-[8px] border-[#E5E5E5] bg-white p-2.5 text-[13px] leading-[1.5] text-[#0A0A0A]"
              />
              <div className="flex items-center justify-between text-[12px] text-[#737373]">
                <span>Sent exactly as written; names are not filled in.</span>
                <span className="tabular-nums">
                  {messageText.length.toLocaleString()} / {MESSAGE_LIMIT.toLocaleString()}
                </span>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Send time"
            summary={timeSummary}
            ready={timeReady}
            open={openSection === "time"}
            onToggle={() => toggle("time")}
          >
            <div role="radiogroup" aria-label="When" className="flex flex-wrap gap-1.5">
              <button type="button" aria-pressed={timing === "now"} onClick={() => setTiming("now")} className={chip(timing === "now")}>
                Send now
              </button>
              <button
                type="button"
                aria-pressed={timing === "scheduled"}
                onClick={() => setTiming("scheduled")}
                className={chip(timing === "scheduled")}
              >
                Schedule
              </button>
            </div>
            {timing === "scheduled" && (
              <div className="flex flex-wrap gap-2.5">
                <div className="flex min-w-[160px] flex-1 flex-col gap-1">
                  <label htmlFor="schedule-date" className={LABEL_CLASS}>Date</label>
                  <Input
                    id="schedule-date"
                    type="date"
                    value={scheduledDate}
                    onChange={(event) => setScheduledDate(event.target.value)}
                  />
                </div>
                <div className="flex min-w-[120px] flex-1 flex-col gap-1">
                  <label htmlFor="schedule-time" className={LABEL_CLASS}>Time</label>
                  <Input
                    id="schedule-time"
                    type="time"
                    value={scheduledTime}
                    onChange={(event) => setScheduledTime(event.target.value)}
                  />
                </div>
                {scheduleCheck.error && (
                  <p role="alert" className="m-0 w-full text-[12px] text-[#B42318]">{scheduleCheck.error}</p>
                )}
              </div>
            )}
          </SectionCard>

          {createBroadcast.isError && (
            <div role="alert" className="flex items-start gap-2 rounded-[10px] border border-[#F5C2C0] bg-[#FDECEC] p-3 text-[13px] text-[#B42318]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Could not send the broadcast.</p>
                <p>{getApiErrorMessage(createBroadcast.error)}</p>
              </div>
            </div>
          )}

          <div className={`${WF.card} flex flex-wrap items-center gap-2.5 px-4 py-3.5`}>
            <button
              type="button"
              disabled={!canSend}
              onClick={handleSend}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-[10px] px-4 text-[13px] font-semibold ${
                canSend || createBroadcast.isPending ? "bg-[#171717] text-[#FAFAFA]" : "cursor-not-allowed bg-[#E5E5E5] text-[#8A8A8A]"
              }`}
            >
              {createBroadcast.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sending…
                </>
              ) : timing === "scheduled" ? (
                `Schedule for ${peopleLabel}`
              ) : (
                `Send to ${peopleLabel}`
              )}
            </button>
            <span className="text-[12px] text-[#737373]">
              {canSend || createBroadcast.isPending
                ? "Messages can't be unsent."
                : "Finish every part above to send."}
            </span>
          </div>
        </section>

        {/* Side panel */}
        <aside aria-label="Preview" className="flex flex-col gap-3 lg:sticky lg:top-4 lg:w-[340px] lg:flex-none">
          <div
            aria-busy={previewLoading}
            className={`${WF.card} flex flex-col gap-2 p-3.5 transition-opacity ${previewLoading ? "opacity-60" : ""}`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-bold">Audience</span>
              {previewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#737373]" /> : null}
            </span>
            <span className="text-[24px] leading-8 font-bold tabular-nums">
              {hasWho && previewQuery.data === undefined ? "—" : peopleLabel}
            </span>
            <span className="flex justify-between gap-1.5 text-[13px]">
              <span className="text-[#525252]">Official agents</span>
              <span className="font-semibold tabular-nums">{officialCount.toLocaleString()}</span>
            </span>
            <span className="flex justify-between gap-1.5 text-[13px]">
              <span className="text-[#525252]">Extra agents</span>
              <span className="font-semibold tabular-nums">{extraCount.toLocaleString()}</span>
            </span>
            <span className="text-[12px] text-[#737373]">{areaLabel}</span>
          </div>

          <div className="flex flex-col gap-2 rounded-[14px] bg-[#EEF1F4] p-3.5">
            <span className="flex justify-between gap-2 text-[12px] font-bold text-[#525252]">
              <span>What recipients see · Telegram</span>
            </span>
            <div className="flex flex-col gap-1.5 rounded-[14px] bg-white px-3 py-2.5">
              <span className="text-[12px] font-bold text-[#2F9E63]">{fromName}</span>
              <span
                className={`text-[13px] leading-[1.5] break-words whitespace-pre-wrap ${trimmedMessage ? "" : "text-[#A3A3A3]"}`}
              >
                {trimmedMessage || "Your message"}
              </span>
              <span className="self-end text-[11px] text-[#A3A3A3]">{bubbleTime}</span>
            </div>
            <div className="flex min-h-9 items-center justify-center rounded-[10px] bg-white text-[13px] font-bold text-[#2F9E63]">
              OK
            </div>
            <span className="mt-1 text-[12px] font-bold text-[#525252]">SMS fallback</span>
            <div
              className={`rounded-[14px] bg-white px-3 py-2.5 text-[13px] leading-[1.5] break-words whitespace-pre-wrap ${
                trimmedMessage ? "text-[#0A0A0A]" : "text-[#A3A3A3]"
              }`}
            >
              {trimmedMessage || "Your message"}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
