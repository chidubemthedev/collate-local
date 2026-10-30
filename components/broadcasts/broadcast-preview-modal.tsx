"use client";

import React, { useState } from "react";
import { BroadcastData } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Send,
  CheckCircle2,
  Clock,
  Radio,
  FileEdit,
  Smartphone,
  Eye,
  Sparkles,
  ExternalLink,
  Bot,
  User,
  Check,
  CheckCheck,
  MapPin,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

interface BroadcastPreviewModalProps {
  broadcast: BroadcastData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BroadcastPreviewModal({
  broadcast,
  open,
  onOpenChange,
}: BroadcastPreviewModalProps) {
  const [useVariablePreview, setUseVariablePreview] = useState<boolean>(true);
  const [acknowledged, setAcknowledged] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"telegram" | "sms" | "details">("telegram");

  if (!broadcast) return null;

  // Render message text with variables replaced or highlighted
  const renderMessageContent = () => {
    let content = broadcast.messageContent || "No message content available.";

    if (useVariablePreview) {
      // Substitute placeholders with sample data
      content = content
        .replace(/\{\{recipient_name\}\}/g, "Chidubem Okafor")
        .replace(/\{\{agent_name\}\}/g, "Chidubem Okafor")
        .replace(/\{\{pu_code\}\}/g, "04-17-03-004")
        .replace(/\{\{pu_name\}\}/g, "Onuilo Ogbeodogwu Square")
        .replace(/\{\{ward_name\}\}/g, "Inland Town I")
        .replace(/\{\{area_name\}\}/g, "Onitsha North LGA")
        .replace(/\{\{gap_count\}\}/g, "12");
    }

    return content;
  };

  const getStatusBadge = (status: BroadcastData["status"]) => {
    switch (status) {
      case "Sent":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs">
            <Send className="w-3 h-3 mr-1" />
            Sent & Delivered
          </Badge>
        );
      case "Scheduled":
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs">
            <Clock className="w-3 h-3 mr-1" />
            Scheduled
          </Badge>
        );
      case "Draft":
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground font-medium text-xs">
            <FileEdit className="w-3 h-3 mr-1" />
            Draft
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Modal Header */}
        <div className="p-5 border-b border-border bg-muted/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                {getStatusBadge(broadcast.status)}
                <Badge variant="outline" className="text-xs font-medium">
                  {broadcast.channel}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[11px] font-mono text-muted-foreground bg-background"
                >
                  {broadcast.id}
                </Badge>
              </div>
              <DialogTitle className="text-lg font-bold text-foreground">
                {broadcast.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground">{broadcast.targetArea}</span>
                <span>•</span>
                <span>{broadcast.sentAt}</span>
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* View Tabs */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as any)}
              className="w-full"
            >
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <TabsList className="bg-muted/60 p-1">
                  <TabsTrigger value="telegram" className="text-xs gap-1.5">
                    <Bot className="w-3.5 h-3.5" />
                    Telegram View
                  </TabsTrigger>
                  <TabsTrigger value="sms" className="text-xs gap-1.5">
                    <Smartphone className="w-3.5 h-3.5" />
                    SMS Fallback View
                  </TabsTrigger>
                  <TabsTrigger value="details" className="text-xs gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    Campaign Meta
                  </TabsTrigger>
                </TabsList>

                {/* Variable toggle */}
                {activeTab !== "details" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUseVariablePreview(!useVariablePreview)}
                    className="h-8 text-xs font-medium"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1 text-primary" />
                    {useVariablePreview ? "Show Raw {{Tags}}" : "Preview Dynamic Values"}
                  </Button>
                )}
              </div>

              {/* 1. Telegram Mobile Mockup */}
              <TabsContent value="telegram" className="mt-0">
                <div className="bg-slate-900/90 dark:bg-slate-950 p-4 sm:p-6 rounded-xl border border-slate-800 text-slate-100 shadow-inner">
                  {/* Telegram Chat Header */}
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-800/80 mb-4">
                    <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white text-sm shadow-xs">
                      NDC
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>NDC Command Bot</span>
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] px-1 py-0 h-4">
                          Verified Bot
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Official Election Directorate Channel · bot
                      </div>
                    </div>
                  </div>

                  {/* Telegram Bubble */}
                  <div className="bg-slate-800/90 border border-slate-700/60 rounded-2xl p-4 max-w-lg shadow-sm">
                    <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed text-slate-100 font-sans">
                      {renderMessageContent()}
                    </div>

                    <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-slate-400">
                      <span>{broadcast.sentAt.split(" ")[1] || "09:14"}</span>
                      <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
                    </div>

                    {/* Interactive Telegram Inline Buttons */}
                    <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-1.5">
                      <button
                        onClick={() => setAcknowledged(!acknowledged)}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                          acknowledged
                            ? "bg-emerald-600/20 border border-emerald-500/40 text-emerald-300"
                            : "bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary-foreground"
                        }`}
                      >
                        {acknowledged ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Acknowledged by Agent (OK Recorded)</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Confirm Received (Tap OK)</span>
                          </>
                        )}
                      </button>

                      <div className="text-[10px] text-center text-slate-400 italic">
                        Interactive bot button simulation for Polling Unit agents
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* 2. SMS Fallback Mockup */}
              <TabsContent value="sms" className="mt-0">
                <div className="bg-slate-100 dark:bg-slate-900/60 p-4 sm:p-6 rounded-xl border border-border text-foreground">
                  <div className="max-w-md mx-auto space-y-3">
                    <div className="text-center text-[11px] text-muted-foreground font-mono">
                      SMS Gateway: NDC-ALERT · +234 800 632 4357
                    </div>

                    <div className="bg-background dark:bg-slate-800 p-4 rounded-2xl border border-border/80 shadow-xs space-y-2">
                      <div className="text-xs whitespace-pre-wrap leading-relaxed">
                        {renderMessageContent()}
                      </div>
                      <div className="text-[10px] text-muted-foreground text-right">
                        Delivered via Telco Route · 160 chars/segment
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold">SMS Fallback Policy</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Triggered automatically when a recipient is not active on Telegram after 5
                          minutes. A unique SMS confirmation code is attached.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* 3. Campaign Meta */}
              <TabsContent value="details" className="mt-0 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <span className="text-muted-foreground block text-[11px]">Sender Identity</span>
                    <span className="font-bold text-foreground mt-0.5 block">
                      {broadcast.senderRole}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card">
                    <span className="text-muted-foreground block text-[11px]">Target Audience</span>
                    <span className="font-bold text-foreground mt-0.5 block">
                      {broadcast.candidatesCount} Candidates + {broadcast.agentsCount} Agents
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card">
                    <span className="text-muted-foreground block text-[11px]">Delivery Channel</span>
                    <span className="font-bold text-foreground mt-0.5 block">
                      {broadcast.channel}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card">
                    <span className="text-muted-foreground block text-[11px]">Dispatch Timestamp</span>
                    <span className="font-bold text-foreground mt-0.5 block">
                      {broadcast.sentAt}
                    </span>
                  </div>
                </div>

                {/* Delivery breakdown */}
                {broadcast.status === "Sent" && (
                  <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>Delivery Execution Breakdown</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                        {broadcast.deliveredPct}% Complete
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-xs pt-1">
                      <div className="p-2 rounded bg-background border border-border">
                        <div className="text-muted-foreground text-[10px]">Delivered</div>
                        <div className="font-bold text-emerald-600 font-mono">
                          {broadcast.delivered}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-background border border-border">
                        <div className="text-muted-foreground text-[10px]">Tapped OK</div>
                        <div className="font-bold text-primary font-mono">{broadcast.tappedOk}</div>
                      </div>
                      <div className="p-2 rounded bg-background border border-border">
                        <div className="text-muted-foreground text-[10px]">SMS Fallback</div>
                        <div className="font-bold text-blue-600 font-mono">
                          {broadcast.deliveredBySms || 0}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-background border border-border">
                        <div className="text-muted-foreground text-[10px]">Failed</div>
                        <div className="font-bold text-rose-600 font-mono">{broadcast.failed}</div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-muted/10 flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Close
          </Button>

          <div className="flex items-center gap-2">
            <Link
              href={`/broadcasts/${broadcast.id}`}
              className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-xs font-medium transition-colors bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 h-8 px-3"
            >
              <span>View Full Delivery Log</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
