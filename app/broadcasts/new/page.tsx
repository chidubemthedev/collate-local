"use client";

import React, { useMemo, useState } from "react";
import { usePermissions } from "@/lib/hooks/use-auth";
import {
  useGeographyLgas,
  useGeographyStates,
  useGeographyWards,
} from "@/lib/hooks/use-geography";
import {
  useAudiencePreview,
  useCreateBroadcast,
} from "@/lib/hooks/use-broadcasts";
import { ApiClientError } from "@/lib/api/client";
import type {
  AudienceFilter,
  CreateBroadcastInput,
} from "@/types/api";
import { StepAudience, AudienceConfig } from "@/components/broadcasts/new/step-audience";
import { StepMessage, MessageConfig } from "@/components/broadcasts/new/step-message";
import { StepSchedule, ScheduleConfig } from "@/components/broadcasts/new/step-schedule";
import { LivePreview } from "@/components/broadcasts/new/live-preview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";

function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return "Your session has expired. Sign in again to continue.";
    if (error.status === 403) return "You do not have permission to create broadcasts.";
    return error.message;
  }
  return "The request failed. Please try again.";
}

export default function NewBroadcastPage() {
  const { data: permissions, isLoading: isLoadingPermissions, error: permissionsError } =
    usePermissions();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [audience, setAudience] = useState<AudienceConfig>({
    stateId: null,
    lgaId: null,
    wardId: null,
    agentKind: "all",
  });
  const [message, setMessage] = useState<MessageConfig>({
    body: `🚨 *POLLING UNIT COVERAGE UPDATE* 🚨\n\nHello {{recipient_name}},\n\nPlease review the latest coverage information for your jurisdiction ({{area_name}}) and coordinate with your local team as needed.`,
  });
  const [schedule, setSchedule] = useState<ScheduleConfig>({
    dispatchTiming: "immediate",
    scheduledDate: "",
    scheduledTime: "",
  });
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const statesQuery = useGeographyStates();
  const lgasQuery = useGeographyLgas(audience.stateId);
  const wardsQuery = useGeographyWards(audience.lgaId);

  const audienceFilter = useMemo<AudienceFilter>(() => {
    const filter: AudienceFilter = { agentKind: audience.agentKind };
    if (audience.stateId !== null) filter.stateId = audience.stateId;
    if (audience.lgaId !== null) filter.lgaId = audience.lgaId;
    if (audience.wardId !== null) filter.wardId = audience.wardId;
    return filter;
  }, [audience]);

  const previewQuery = useAudiencePreview(audienceFilter, {
    enabled: Boolean(permissions?.canBroadcast),
  });

  const createBroadcast = useCreateBroadcast();

  const preview = previewQuery.data ?? null;
  const totalRecipients = preview
    ? audience.agentKind === "official"
      ? preview.officialCount
      : audience.agentKind === "extra"
        ? preview.extraCount
        : preview.officialCount + preview.extraCount
    : null;

  const targetAreaLabel = useMemo(() => {
    if (audience.wardId !== null) {
      const ward = wardsQuery.data?.find((item) => item.id === audience.wardId);
      return ward?.name ?? "Selected ward";
    }
    if (audience.lgaId !== null) {
      const lga = lgasQuery.data?.find((item) => item.id === audience.lgaId);
      return lga?.name ?? "Selected LGA";
    }
    if (audience.stateId !== null) {
      const state = statesQuery.data?.find((item) => item.id === audience.stateId);
      return state?.name ?? "Selected state";
    }
    return "All areas in your permitted scope";
  }, [audience, lgasQuery.data, statesQuery.data, wardsQuery.data]);

  const handleCreateBroadcast = () => {
    if (!preview || totalRecipients === null || totalRecipients === 0) return;

    let scheduledSendAt: string | undefined;
    if (schedule.dispatchTiming === "scheduled") {
      if (!schedule.scheduledDate || !schedule.scheduledTime) {
        setScheduleError("Choose a date and time to schedule this broadcast.");
        return;
      }
      const scheduledDateTime = new Date(`${schedule.scheduledDate}T${schedule.scheduledTime}`);
      const now = Date.now();
      if (
        Number.isNaN(scheduledDateTime.getTime()) ||
        scheduledDateTime.getTime() <= now ||
        scheduledDateTime.getTime() > now + 90 * 24 * 60 * 60 * 1000
      ) {
        setScheduleError("Select a future date and time within the next 90 days.");
        return;
      }
      scheduledSendAt = scheduledDateTime.toISOString();
    }

    setScheduleError(null);
    const payload: CreateBroadcastInput = {
      audienceFilter,
      messageText: message.body.trim(),
      ...(scheduledSendAt ? { scheduledSendAt } : {}),
    };
    createBroadcast.mutate(payload);
  };

  const goToPreviousStep = () => {
    setCurrentStep((step) => (step === 3 ? 2 : 1));
  };
  const goToNextStep = () => {
    setCurrentStep((step) => (step === 1 ? 2 : 3));
  };

  if (isLoadingPermissions) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking broadcast access…
      </div>
    );
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

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/broadcasts" className="flex items-center gap-1 transition-colors hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Broadcasts</span>
            </Link>
            <span>/</span>
            <span className="font-semibold text-foreground">New Campaign</span>
          </div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            <Send className="h-6 w-6 text-primary" />
            <span>Compose Broadcast</span>
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Preview a permitted audience and queue a message through the broadcast API.
          </p>
        </div>
        <Badge variant="outline" className="w-fit text-xs">
          Sending as: {permissions.roles.join(", ") || "Account"}
        </Badge>
      </div>

      {createBroadcast.isSuccess && (
        <div role="status" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              Telegram broadcast queued. Status: <strong className="font-semibold uppercase">{createBroadcast.data.status}</strong>.
            </span>
          </div>
          <Link
            href={`/broadcasts/${createBroadcast.data.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline shrink-0"
          >
            <span>View Delivery Report</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {createBroadcast.isError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Could not create the broadcast.</p>
            <p>{getApiErrorMessage(createBroadcast.error)}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {([1, 2, 3] as const).map((step) => {
          const label =
            step === 1 ? "Target Audience" : step === 2 ? "Message Copy" : "Timing";
          const detail =
            step === 1
              ? `${totalRecipients?.toLocaleString() ?? "—"} recipients`
              : step === 2
                ? `${message.body.length} characters`
                : schedule.dispatchTiming === "immediate"
                  ? "Send now"
                  : "Scheduled";
          return (
            <button
              key={step}
              type="button"
              onClick={() => setCurrentStep(step)}
              className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                currentStep === step
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background/80 text-xs font-bold text-foreground">
                {currentStep > step ? <CheckCircle2 className="h-4 w-4" /> : step}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold">{step}. {label}</span>
                <span className="block truncate text-[10px] opacity-80">{detail}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          {currentStep === 1 && (
            <StepAudience
              audience={audience}
              onChange={setAudience}
              preview={preview}
              previewLoading={previewQuery.isLoading || previewQuery.isFetching}
              previewError={previewQuery.isError ? getApiErrorMessage(previewQuery.error) : null}
              onRetryPreview={() => void previewQuery.refetch()}
            />
          )}

          {currentStep === 2 && <StepMessage message={message} onChange={setMessage} />}

          {currentStep === 3 && (
            <StepSchedule
              schedule={schedule}
              onChange={(updated) => {
                setSchedule(updated);
                setScheduleError(null);
              }}
              totalRecipients={totalRecipients ?? 0}
            />
          )}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            {currentStep > 1 ? (
              <Button type="button" variant="outline" size="sm" onClick={goToPreviousStep} className="gap-1.5 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" />
                Previous Step
              </Button>
            ) : (
              <Link href="/broadcasts" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3.5 w-3.5" />
                Cancel
              </Link>
            )}

            {currentStep < 3 ? (
              <Button type="button" size="sm" onClick={goToNextStep} className="gap-1.5 text-xs">
                <span>Continue to Step {currentStep + 1}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={
                  createBroadcast.isPending ||
                  previewQuery.isLoading ||
                  previewQuery.isError ||
                  totalRecipients === null ||
                  totalRecipients === 0 ||
                  !message.body.trim() ||
                  (schedule.dispatchTiming === "scheduled" &&
                    (!schedule.scheduledDate || !schedule.scheduledTime))
                }
                onClick={handleCreateBroadcast}
                className="gap-1.5 text-xs font-bold"
              >
                {createBroadcast.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating broadcast…</span>
                  </>
                ) : schedule.dispatchTiming === "immediate" ? (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Send Broadcast Now ({totalRecipients ?? 0} recipients)</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4" />
                    <span>Schedule Campaign</span>
                  </>
                )}
              </Button>
            )}
          </div>

          {scheduleError && (
            <p role="alert" className="text-right text-xs text-destructive">
              {scheduleError}
            </p>
          )}
        </div>

        <div className="lg:col-span-5">
          <LivePreview
            message={message}
            schedule={schedule}
            targetAreaLabel={targetAreaLabel}
            totalRecipients={totalRecipients}
          />
        </div>
      </div>
    </div>
  );
}
