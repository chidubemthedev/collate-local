"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Smartphone,
  CheckCircle2,
  Camera,
  MapPin,
  Sparkles,
  CheckCheck,
  Send,
  Eye,
  Info,
} from "lucide-react";
import { MessageConfig } from "./step-message";
import { ScheduleConfig } from "./step-schedule";

interface LivePreviewProps {
  message: MessageConfig;
  schedule: ScheduleConfig;
  targetAreaLabel: string;
  totalRecipients: number;
}

export function LivePreview({
  message,
  schedule,
  targetAreaLabel,
  totalRecipients,
}: LivePreviewProps) {
  const [previewMode, setPreviewMode] = useState<"telegram" | "sms">("telegram");
  const [useVariablePreview, setUseVariablePreview] = useState<boolean>(true);

  // Variable substitution
  const renderBody = () => {
    let text = message.body || "Your message preview will appear here...";

    if (useVariablePreview) {
      text = text
        .replace(/\{\{recipient_name\}\}/g, "Chidubem Okafor")
        .replace(/\{\{agent_name\}\}/g, "Chidubem Okafor")
        .replace(/\{\{pu_code\}\}/g, "04-17-03-004")
        .replace(/\{\{pu_name\}\}/g, "Onuilo Ogbeodogwu Square")
        .replace(/\{\{ward_name\}\}/g, "Inland Town I")
        .replace(/\{\{lga_name\}\}/g, "Onitsha North LGA")
        .replace(/\{\{area_name\}\}/g, targetAreaLabel)
        .replace(/\{\{state_name\}\}/g, "Anambra State");
    }

    return text;
  };

  return (
    <div className="space-y-4 sticky top-6">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-primary" />
          <span>Real-time Live Preview</span>
        </h4>

        {/* Telegram / SMS Switcher */}
        <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setPreviewMode("telegram")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1 ${
              previewMode === "telegram"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bot className="w-3 h-3 text-sky-500" />
            <span>Telegram</span>
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode("sms")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1 ${
              previewMode === "sms"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Smartphone className="w-3 h-3 text-emerald-500" />
            <span>SMS</span>
          </button>
        </div>
      </div>

      {/* Mobile Device Frame */}
      <div className="rounded-2xl border-2 border-border/80 bg-card overflow-hidden shadow-md">
        {/* Device Notch Header */}
        <div className="bg-muted/60 px-4 py-2 border-b border-border/60 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
          <span>09:41</span>
          <div className="w-16 h-3 bg-muted-foreground/20 rounded-full" />
          <span>4G LTE</span>
        </div>

        {previewMode === "telegram" ? (
          /* Telegram Bubble View */
          <div className="bg-slate-900 p-4 min-h-[380px] flex flex-col justify-between text-slate-100">
            <div>
              {/* Bot Identity */}
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-800 mb-3">
                <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white text-xs">
                  NDC
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1">
                    <span>NDC Command Bot</span>
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[9px] px-1 py-0 h-3.5">
                      Bot
                    </Badge>
                  </div>
                  <div className="text-[10px] text-slate-400">Election Directorate</div>
                </div>
              </div>

              {/* Message Bubble */}
              <div className="bg-slate-800/95 border border-slate-700/80 rounded-2xl p-3.5 shadow-sm space-y-2">
                <div className="text-xs whitespace-pre-wrap leading-relaxed font-sans text-slate-100">
                  {renderBody()}
                </div>

                <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400">
                  <span>09:41</span>
                  <CheckCheck className="w-3 h-3 text-sky-400" />
                </div>

                {/* Attached Interactive Buttons */}
                <div className="pt-2 border-t border-slate-700/60 space-y-1.5">
                  {message.hasAcknowledgeButton && (
                    <div className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{message.acknowledgeButtonText || "Confirm Received (Tap OK)"}</span>
                    </div>
                  )}

                  {message.hasPhotoUploadButton && (
                    <div className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-blue-600/20 border border-blue-500/40 text-blue-300 flex items-center justify-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" />
                      <span>{message.photoUploadButtonText || "📸 Upload Form EC8A Photo"}</span>
                    </div>
                  )}

                  {message.hasGpsButton && (
                    <div className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-amber-600/20 border border-amber-500/40 text-amber-300 flex items-center justify-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{message.gpsButtonText || "📍 Verify GPS Coordinates"}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="text-[10px] text-center text-slate-500 pt-3">
              Encrypted Telegram bot channel
            </div>
          </div>
        ) : (
          /* SMS Fallback View */
          <div className="bg-slate-100 dark:bg-slate-900 p-4 min-h-[380px] flex flex-col justify-between text-foreground">
            <div>
              <div className="text-center text-[10px] text-muted-foreground font-mono mb-3">
                Sender: NDC-ALERT
              </div>

              <div className="bg-background dark:bg-slate-800 border border-border rounded-2xl p-3.5 shadow-xs space-y-2">
                <div className="text-xs whitespace-pre-wrap leading-relaxed">
                  {renderBody()}
                </div>
                <div className="text-[10px] text-muted-foreground text-right">
                  Via Telco SMS · 1-tap reply link attached
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-muted/60 border border-border text-[10px] text-muted-foreground">
              Fallback triggered automatically if Telegram message unacknowledged after{" "}
              {schedule.fallbackTimeoutMinutes} minutes.
            </div>
          </div>
        )}
      </div>

      {/* Target Audience Summary Card */}
      <div className="p-3.5 rounded-xl border border-border bg-card space-y-1.5 text-xs">
        <div className="flex items-center justify-between font-bold text-foreground">
          <span>Target Destination</span>
          <span className="font-mono text-primary font-extrabold">
            {totalRecipients.toLocaleString()} Dispatches
          </span>
        </div>
        <div className="text-muted-foreground text-[11px] truncate">
          Scope: <strong>{targetAreaLabel}</strong>
        </div>
      </div>
    </div>
  );
}
