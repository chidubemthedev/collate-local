"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/lib/context/app-context";
import { StepAudience, AudienceConfig } from "@/components/broadcasts/new/step-audience";
import { StepMessage, MessageConfig } from "@/components/broadcasts/new/step-message";
import { StepSchedule, ScheduleConfig } from "@/components/broadcasts/new/step-schedule";
import { LivePreview } from "@/components/broadcasts/new/live-preview";
import { STATES_DATA, LGAS_DATA, WARDS_DATA, POLLING_UNITS_DATA } from "@/lib/data/inec-data";
import { CANDIDATES_DATA } from "@/lib/data/candidates-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Send,
  Clock,
  CheckCircle2,
  FileEdit,
  Radio,
  Users,
  MessageSquare,
  Sparkles,
  Eye,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NewBroadcastPage() {
  const router = useRouter();
  const { activePersona } = useApp();

  const isCandidatePersona = activePersona.role.startsWith("Candidate");

  // Step state (1: Audience, 2: Message, 3: Schedule)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Audience Configuration State
  const [audience, setAudience] = useState<AudienceConfig>({
    includeCandidates: true,
    includeOfficialAgents: true,
    includeExtraAgents: true,
    includeCoordinators: true,
    scopeType: isCandidatePersona ? "lga" : "national",
    stateCode: activePersona.stateCode || "04",
    lgaCode: activePersona.lgaCode || (isCandidatePersona ? "04-17" : "all"),
    wardCode: "all",
  });

  // Message Configuration State
  const [message, setMessage] = useState<MessageConfig>({
    title: "Urgent Polling Unit Coverage Gap Alert",
    body: `🚨 *URGENT NDC POLLING UNIT GAP ALERT* 🚨\n\nHello {{recipient_name}},\n\nOur live audit shows that several Polling Units in your jurisdiction (*{{area_name}}*) currently have **NO official party agent** assigned.\n\n⚠️ *Action Required:* Please contact your Ward Coordinator immediately to nominate verified agents for these units before 18:00 WAT today.\n\nTap **[ Confirm Received ]** below to log your acknowledgment.`,
    hasAcknowledgeButton: true,
    acknowledgeButtonText: "Confirm Received (Tap OK)",
    hasPhotoUploadButton: false,
    photoUploadButtonText: "📸 Upload Form EC8A Photo",
    hasGpsButton: false,
    gpsButtonText: "📍 Verify GPS Coordinates",
  });

  // Schedule Configuration State
  const [schedule, setSchedule] = useState<ScheduleConfig>({
    channelMode: "telegram_and_sms",
    fallbackTimeoutMinutes: 5,
    dispatchTiming: "immediate",
    scheduledDate: "2026-10-31",
    scheduledTime: "07:00",
    requireDeliveryConfirmation: true,
  });

  // Dispatch progress state
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Computed Audience Counts based on selected filters
  const computedCounts = useMemo(() => {
    // 1. Filter PUs
    let pus = POLLING_UNITS_DATA;
    if (audience.scopeType !== "national") {
      if (audience.stateCode !== "all") {
        pus = pus.filter((p) => p.stateCode === audience.stateCode);
      }
      if (audience.lgaCode !== "all") {
        pus = pus.filter((p) => p.lgaCode === audience.lgaCode);
      }
      if (audience.wardCode !== "all") {
        pus = pus.filter((p) => p.wardCode === audience.wardCode);
      }
    }

    const officialAgentsCount = audience.includeOfficialAgents
      ? pus.filter((p) => p.hasOfficialAgent).length
      : 0;

    const extraAgentsCount = audience.includeExtraAgents
      ? pus.reduce((sum, p) => sum + p.extraAgents.length, 0)
      : 0;

    // 2. Candidates
    let cands = CANDIDATES_DATA;
    if (audience.scopeType !== "national" && audience.stateCode !== "all") {
      cands = cands.filter((c) => !c.stateCode || c.stateCode === audience.stateCode);
    }
    const candidatesCount = audience.includeCandidates ? cands.length : 0;

    const total = candidatesCount + officialAgentsCount + extraAgentsCount;
    const telegramReady = Math.round(total * 0.88);
    const smsFallback = total - telegramReady;

    return {
      candidates: candidatesCount,
      officialAgents: officialAgentsCount,
      extraAgents: extraAgentsCount,
      total,
      telegramReady,
      smsFallback,
    };
  }, [audience]);

  // Target Area Label
  const targetAreaLabel = useMemo(() => {
    if (audience.scopeType === "national") return "Nigeria (National · All 37 States)";
    if (audience.scopeType === "ward" && audience.wardCode !== "all") {
      const ward = WARDS_DATA.find((w) => w.code === audience.wardCode);
      return `${ward?.code} · ${ward?.name}, Anambra`;
    }
    if (audience.scopeType === "lga" && audience.lgaCode !== "all") {
      const lga = LGAS_DATA.find((l) => l.code === audience.lgaCode);
      return `${lga?.code} · ${lga?.name} LGA, Anambra`;
    }
    if (audience.stateCode !== "all") {
      const state = STATES_DATA.find((s) => s.code === audience.stateCode);
      return `${state?.code} · ${state?.name} State`;
    }
    return "All Geographies";
  }, [audience]);

  // Handle Dispatch / Schedule
  const handleDispatch = () => {
    setIsSending(true);

    setTimeout(() => {
      setIsSending(false);
      setIsSuccess(true);

      setTimeout(() => {
        router.push("/broadcasts");
      }, 1500);
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
            <Link
              href="/broadcasts"
              className="hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Broadcasts</span>
            </Link>
            <span>/</span>
            <span className="text-foreground font-semibold">New Campaign</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Send className="w-6 h-6 text-primary" />
            <span>Compose Broadcast Alert</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Configure target audience, craft your alert message, and dispatch via Telegram + SMS
            fallback.
          </p>
        </div>

        {/* Persona Scoping Notice */}
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs py-1 px-2.5 font-medium bg-muted/50 border-border flex items-center gap-1.5"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Sending as: <strong>{activePersona.label}</strong></span>
          </Badge>
        </div>
      </div>

      {/* Stepper Navigation */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {/* Step 1 Tab */}
        <button
          type="button"
          onClick={() => setCurrentStep(1)}
          className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
            currentStep === 1
              ? "bg-primary text-primary-foreground border-primary shadow-xs"
              : currentStep > 1
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
              : "bg-card border-border text-muted-foreground"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              currentStep === 1
                ? "bg-primary-foreground text-primary"
                : currentStep > 1
                ? "bg-emerald-600 text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {currentStep > 1 ? <CheckCircle2 className="w-4 h-4" /> : "1"}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold truncate">1. Target Audience</div>
            <div
              className={`text-[10px] truncate ${
                currentStep === 1 ? "text-primary-foreground/80" : "text-muted-foreground"
              }`}
            >
              {computedCounts.total.toLocaleString()} recipients
            </div>
          </div>
        </button>

        {/* Step 2 Tab */}
        <button
          type="button"
          onClick={() => setCurrentStep(2)}
          className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
            currentStep === 2
              ? "bg-primary text-primary-foreground border-primary shadow-xs"
              : currentStep > 2
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
              : "bg-card border-border text-muted-foreground"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              currentStep === 2
                ? "bg-primary-foreground text-primary"
                : currentStep > 2
                ? "bg-emerald-600 text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {currentStep > 2 ? <CheckCircle2 className="w-4 h-4" /> : "2"}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold truncate">2. Message Copy</div>
            <div
              className={`text-[10px] truncate ${
                currentStep === 2 ? "text-primary-foreground/80" : "text-muted-foreground"
              }`}
            >
              {message.body.length} characters
            </div>
          </div>
        </button>

        {/* Step 3 Tab */}
        <button
          type="button"
          onClick={() => setCurrentStep(3)}
          className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
            currentStep === 3
              ? "bg-primary text-primary-foreground border-primary shadow-xs"
              : "bg-card border-border text-muted-foreground"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              currentStep === 3
                ? "bg-primary-foreground text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            3
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold truncate">3. Channel & Timing</div>
            <div
              className={`text-[10px] truncate ${
                currentStep === 3 ? "text-primary-foreground/80" : "text-muted-foreground"
              }`}
            >
              {schedule.dispatchTiming === "immediate" ? "Send Now" : "Scheduled"}
            </div>
          </div>
        </button>
      </div>

      {/* Main Content Layout: Step Form (Left) + Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form Column (7 Cols on desktop) */}
        <div className="lg:col-span-7 space-y-6">
          {currentStep === 1 && (
            <StepAudience
              audience={audience}
              onChange={setAudience}
              activePersona={activePersona}
              computedCounts={computedCounts}
            />
          )}

          {currentStep === 2 && (
            <StepMessage message={message} onChange={setMessage} />
          )}

          {currentStep === 3 && (
            <StepSchedule
              schedule={schedule}
              onChange={setSchedule}
              totalRecipients={computedCounts.total}
            />
          )}

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
            {currentStep > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                className="text-xs gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Previous Step
              </Button>
            ) : (
              <Link
                href="/broadcasts"
                className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Cancel
              </Link>
            )}

            <div className="flex items-center gap-2">
              {currentStep < 3 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCurrentStep((prev) => (prev + 1) as any)}
                  className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
                >
                  <span>Continue to Step {currentStep + 1}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={isSending || isSuccess}
                  onClick={handleDispatch}
                  className={`text-xs gap-1.5 font-bold shadow-md ${
                    schedule.dispatchTiming === "immediate"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {isSending ? (
                    <>
                      <Radio className="w-4 h-4 animate-spin" />
                      <span>Transmitting Broadcast...</span>
                    </>
                  ) : isSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span>Dispatched Successfully!</span>
                    </>
                  ) : schedule.dispatchTiming === "immediate" ? (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Broadcast Now ({computedCounts.total} recipients)</span>
                    </>
                  ) : schedule.dispatchTiming === "scheduled" ? (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>Schedule Campaign for {schedule.scheduledDate}</span>
                    </>
                  ) : (
                    <>
                      <FileEdit className="w-4 h-4" />
                      <span>Save Campaign as Draft</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right Live Preview Column (5 Cols on desktop) */}
        <div className="lg:col-span-5">
          <LivePreview
            message={message}
            schedule={schedule}
            targetAreaLabel={targetAreaLabel}
            totalRecipients={computedCounts.total}
          />
        </div>
      </div>
    </div>
  );
}
