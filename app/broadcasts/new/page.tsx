"use client";

import React, { useMemo, useState } from "react";
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
import { ComposeBroadcastSkeleton } from "@/components/broadcasts/new/new-broadcast-skeletons";
import { toTitleCase } from "@/components/candidates/candidates-filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldSpinner } from "@/components/ui/field-spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, ArrowLeft, Check, Loader2 } from "lucide-react";

type Section = "to" | "message" | "time";

const MESSAGE_LIMIT = 1000; // the API's maximum
const MAX_SCHEDULE_DAYS = 90; // the API's maximum

const LABEL_CLASS =
  "flex items-center gap-1.5 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground";
const TRIGGER_CLASS = "h-8 w-full bg-background text-xs data-[disabled]:bg-muted data-[disabled]:opacity-70";

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
      className={`rounded-2xl border bg-card p-4 sm:p-5 transition-colors ${
        open ? "border-foreground/40" : "border-border/70"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
            ready ? "bg-emerald-600 text-white" : "border-2 border-border bg-background"
          }`}
          aria-label={ready ? "Ready" : "Not ready yet"}
        >
          {ready && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{summary}</div>
        </div>
        {onToggle && (
          <Button variant="outline" size="sm" className="h-8 shrink-0 px-3 text-xs" onClick={onToggle}>
            {open ? "Done" : "Edit"}
          </Button>
        )}
      </div>
      {open && children && <div className="mt-4 space-y-4 border-t border-border/60 pt-4">{children}</div>}
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

  const statesQuery = useGeographyStates();
  const lgasQuery = useGeographyLgas(stateId);
  const wardsQuery = useGeographyWards(lgaId);
  const pollingUnitsQuery = useGeographyPollingUnits(wardId);
  const groupsQuery = useOwnerGroups();

  const states = statesQuery.data ?? [];
  const lgas = stateId === null ? [] : lgasQuery.data ?? [];
  const wards = lgaId === null ? [] : wardsQuery.data ?? [];
  const pollingUnits = wardId === null ? [] : pollingUnitsQuery.data ?? [];
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
    const at = new Date(`${scheduledDate}T${scheduledTime}`);
    const now = Date.now();
    if (Number.isNaN(at.getTime()) || at.getTime() <= now) {
      return { ok: false, error: "Pick a time in the future." };
    }
    if (at.getTime() > now + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000) {
      return { ok: false, error: `Pick a time within the next ${MAX_SCHEDULE_DAYS} days.` };
    }
    return { ok: true, at };
  }, [timing, scheduledDate, scheduledTime]);
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
    return <ComposeBroadcastSkeleton />;
  }

  if (permissionsError) {
    return (
      <div role="alert" className="mx-auto mt-12 max-w-xl space-y-3 rounded-xl border border-border p-6 text-center">
        <p className="text-sm text-destructive">{getApiErrorMessage(permissionsError)}</p>
        <Link href="/login" className="text-xs text-primary hover:underline">
          Return to sign in
        </Link>
      </div>
    );
  }

  if (!permissions?.canBroadcast) {
    return (
      <div role="alert" className="mx-auto mt-12 max-w-xl rounded-xl border border-border p-6 text-center">
        <p className="text-sm font-semibold">Broadcast access required</p>
        <p className="mt-1 text-xs text-muted-foreground">
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
  const bubbleTime = scheduleCheck.at ? formatClock(scheduleCheck.at) : formatClock(new Date());

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
      active
        ? "border-foreground bg-foreground text-background"
        : "border-border bg-background text-foreground hover:bg-muted"
    }`;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="space-y-2">
        <Link
          href="/broadcasts"
          className="-ml-2 inline-flex h-7 items-center rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Broadcasts
        </Link>
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">New broadcast</h1>
          <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground">
            Fill in each part; it ticks green when it is ready to send
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Form */}
        <div className="space-y-3">
          <SectionCard
            title="To"
            summary={toSummary}
            ready={toReady}
            open={openSection === "to"}
            onToggle={() => toggle("to")}
          >
            <div className="space-y-2">
              <div className={LABEL_CLASS}>Who</div>
              <div className="flex flex-wrap gap-2">
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
              {!hasWho && <p className="text-[11px] text-destructive">Pick at least one.</p>}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
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

              <div className="min-w-0 space-y-1.5">
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

              <div className="min-w-0 space-y-1.5">
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

              <div className="min-w-0 space-y-1.5">
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
                className="min-w-0 space-y-1.5"
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
                  <p className="text-[10px] text-muted-foreground">Pick only Extra agents to filter by owner.</p>
                )}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              An area message reaches every agent at the polling units in it.
            </p>
            {previewQuery.isError && (
              <div role="alert" className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{getApiErrorMessage(previewQuery.error)}</span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => void previewQuery.refetch()}
                >
                  Retry
                </Button>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="From"
            summary={`${session?.person?.fullName ?? "You"} · Telegram with SMS fallback`}
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
            <div className="space-y-1.5">
              <label htmlFor="broadcast-message" className={LABEL_CLASS}>Message</label>
              <Textarea
                id="broadcast-message"
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                rows={6}
                maxLength={MESSAGE_LIMIT}
                placeholder="Write what agents will read. An OK button is added for them to tap."
                className="bg-background text-sm"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
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
            <div className="flex flex-wrap gap-2">
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="schedule-date" className={LABEL_CLASS}>Date</label>
                  <Input
                    id="schedule-date"
                    type="date"
                    value={scheduledDate}
                    onChange={(event) => setScheduledDate(event.target.value)}
                    className="h-8 bg-background text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="schedule-time" className={LABEL_CLASS}>Time</label>
                  <Input
                    id="schedule-time"
                    type="time"
                    value={scheduledTime}
                    onChange={(event) => setScheduledTime(event.target.value)}
                    className="h-8 bg-background text-xs"
                  />
                </div>
                {scheduleCheck.error && (
                  <p role="alert" className="text-[11px] text-destructive sm:col-span-2">{scheduleCheck.error}</p>
                )}
              </div>
            )}
          </SectionCard>

          {createBroadcast.isError && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Could not send the broadcast.</p>
                <p>{getApiErrorMessage(createBroadcast.error)}</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card p-4">
            <Button
              type="button"
              disabled={!canSend}
              onClick={handleSend}
              className="h-9 gap-1.5 bg-foreground px-4 text-xs font-semibold text-background hover:bg-foreground/90"
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
            </Button>
            <span className="text-[11px] text-muted-foreground">
              {canSend || createBroadcast.isPending
                ? "Messages can't be unsent."
                : "Finish every part above to send."}
            </span>
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-3 lg:sticky lg:top-4">
          <div
            aria-busy={previewLoading}
            className={`rounded-2xl border border-border/70 bg-card p-4 transition-opacity ${previewLoading ? "opacity-60" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">Audience</div>
              {previewLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {hasWho && previewQuery.data === undefined ? "—" : peopleLabel}
            </div>
            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Official agents</dt>
                <dd className="font-semibold tabular-nums text-foreground">{officialCount.toLocaleString()}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Extra agents</dt>
                <dd className="font-semibold tabular-nums text-foreground">{extraCount.toLocaleString()}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] text-muted-foreground">{areaLabel}</p>
          </div>

          <div className="space-y-3 rounded-2xl bg-muted/70 p-3">
            <div className="text-[11px] font-semibold text-muted-foreground">What agents see · Telegram</div>
            <div className="rounded-xl bg-background p-3">
              <p className={`whitespace-pre-wrap break-words text-xs ${trimmedMessage ? "text-foreground" : "italic text-muted-foreground"}`}>
                {trimmedMessage || "Your message will appear here."}
              </p>
              <div className="mt-1.5 text-right text-[10px] text-muted-foreground">{bubbleTime}</div>
            </div>
            <div className="rounded-xl bg-background py-2 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              OK
            </div>

            <div className="pt-1 text-[11px] font-semibold text-muted-foreground">SMS fallback</div>
            <div className="rounded-xl bg-background p-3">
              <p className={`whitespace-pre-wrap break-words text-xs ${trimmedMessage ? "text-foreground" : "italic text-muted-foreground"}`}>
                {trimmedMessage || "Your message will appear here."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
