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
import {
  Bot,
  Smartphone,
  CheckCheck,
  CheckCircle2,
  Sparkles,
  ExternalLink,
} from "lucide-react";

interface ReportMessageModalProps {
  broadcast: BroadcastData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportMessageModal({
  broadcast,
  open,
  onOpenChange,
}: ReportMessageModalProps) {
  const [useVariablePreview, setUseVariablePreview] = useState<boolean>(true);

  const renderContent = () => {
    let content = broadcast.messageContent || "No message content available.";

    if (useVariablePreview) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto p-0 gap-0">
        <div className="p-5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
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
          <DialogTitle className="text-base font-bold text-foreground">
            {broadcast.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Sent at {broadcast.sentAt} to {broadcast.targetArea}
          </DialogDescription>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Dispatched Message Copy</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUseVariablePreview(!useVariablePreview)}
              className="h-7 text-xs font-medium"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 text-primary" />
              {useVariablePreview ? "Show Raw {{Tags}}" : "Preview Dynamic Values"}
            </Button>
          </div>

          <div className="bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-800 text-slate-100 shadow-inner">
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-800 mb-3">
              <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white text-xs">
                NDC
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1">
                  <span>NDC Command Bot</span>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[9px] px-1 py-0 h-3.5">
                    Verified
                  </Badge>
                </div>
                <div className="text-[10px] text-slate-400">Official Telegram Channel</div>
              </div>
            </div>

            <div className="text-xs whitespace-pre-wrap leading-relaxed font-sans text-slate-100 bg-slate-800/90 p-3.5 rounded-xl border border-slate-700/60">
              {renderContent()}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border bg-muted/10 flex items-center justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
