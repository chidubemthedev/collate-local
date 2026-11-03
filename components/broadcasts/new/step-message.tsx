"use client";

import React, { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sparkles,
  Zap,
} from "lucide-react";

export interface MessageConfig {
  body: string;
}

interface StepMessageProps {
  message: MessageConfig;
  onChange: (updated: MessageConfig) => void;
}

const TEMPLATES = [
  {
    id: "gap-alert",
    name: "PU Coverage Gap Alert",
    content: `🚨 *URGENT NDC POLLING UNIT GAP ALERT* 🚨\n\nHello {{recipient_name}},\n\nOur live audit shows that several Polling Units in your area (*{{area_name}}*) have NO official party agent assigned.\n\n⚠️ Please coordinate with your Ward Coordinator immediately to nominate verified agents.\n\nTap [ Confirm Received ] below to log your acknowledgment.`,
  },
  {
    id: "accreditation-check",
    name: "06:00 WAT Accreditation Drill",
    content: `📋 *NDC ELECTION-DAY DIRECTIVE*\n\nTo all NDC Polling Unit Agents:\n1. Arrive at {{pu_code}} ({{pu_name}}) by 06:30 WAT.\n2. Inspect BVAS zero counter before polling starts.\n3. Report any late INEC arrival immediately to the Situation Room.\n\nTap [ Acknowledge & Verify ] below.`,
  },
  {
    id: "ec8a-drill",
    name: "EC8A Result Sheet Photo Drill",
    content: `📸 *NATIONAL EC8A RESULT UPLOAD DRILL*\n\nTo all Official Agents:\nWhen voting closes at {{pu_code}}:\n1. Photograph Form EC8A clearly with all four corners visible.\n2. Verify Presiding Officer and Police signatures are legible.\n3. Upload the photo directly via the button below.`,
  },
  {
    id: "security-sos",
    name: "Security SOS Protocol",
    content: `🛡️ *SECURITY DIRECTIVE & SOS INTERVENTION*\n\nIf you experience intimidation or ballot disruption at {{pu_code}}:\n1. Move to a secure location.\n2. Tap the emergency trigger below to alert the National Legal & Security Rapid Intervention Unit.\n3. National Hotline: 0800-NDC-HELP (0800-632-4357).`,
  },
];

const VARIABLE_PILLS = [
  { tag: "{{recipient_name}}", label: "Recipient Name" },
  { tag: "{{pu_code}}", label: "PU Code" },
  { tag: "{{pu_name}}", label: "PU Name" },
  { tag: "{{ward_name}}", label: "Ward Name" },
  { tag: "{{lga_name}}", label: "LGA Name" },
  { tag: "{{state_name}}", label: "State Name" },
];

export function StepMessage({ message, onChange }: StepMessageProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Character length computation (Telegram limit: 1000 characters)
  const charLength = message.body.length;
  const isOverLimit = charLength > 1000;

  const handleApplyTemplate = (tmpl: (typeof TEMPLATES)[0]) => {
    onChange({
      ...message,
      body: tmpl.content,
    });
  };

  const handleInsertVariable = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange({
        ...message,
        body: message.body + " " + tag,
      });
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = message.body;
    const newText = currentText.substring(0, start) + tag + currentText.substring(end);

    onChange({
      ...message,
      body: newText,
    });

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 10);
  };

  return (
    <div className="space-y-6">
      {/* 1. Quick Starter Templates */}
      <Card className="border-border/80 shadow-xs bg-card">
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Quick Campaign Templates</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Load a pre-configured template with proven high-response copy.
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              Step 2 of 3
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => handleApplyTemplate(tmpl)}
                className="p-2.5 rounded-xl border border-border bg-muted/20 hover:bg-primary/5 hover:border-primary/40 transition-all text-left group"
              >
                <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-primary shrink-0" />
                  <span className="truncate">{tmpl.name}</span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 2. Message Composer */}
      <Card className="border-border/80 shadow-xs bg-card">
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Dynamic Variable Chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <span>Dynamic Tags</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  (Click to insert personalized variable)
                </span>
              </Label>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {VARIABLE_PILLS.map((pill) => (
                <button
                  key={pill.tag}
                  type="button"
                  onClick={() => handleInsertVariable(pill.tag)}
                  className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-primary/10 hover:text-primary hover:border-primary/30 border border-border text-[11px] font-mono font-medium transition-colors"
                >
                  +{pill.tag}
                </button>
              ))}
            </div>
          </div>

          {/* Message Body Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Message Body (Telegram Markdown)</Label>
              <div className="text-[11px] font-mono flex items-center gap-2">
                <span className={isOverLimit ? "text-destructive font-bold" : "text-muted-foreground"}>
                  {charLength} / 1000 chars
                </span>
                <span>•</span>
                <span className="text-muted-foreground">Telegram Direct</span>
              </div>
            </div>

            <Textarea
              ref={textareaRef}
              rows={8}
              placeholder="Type your alert message here... You can use markdown like *bold*, _italic_, and `code`."
              value={message.body}
              onChange={(e) => onChange({ ...message, body: e.target.value })}
              className="text-xs font-sans leading-relaxed bg-background"
            />
          </div>

          {/* Unsupported interactive actions */}
          <div className="space-y-2 border-t border-border pt-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <span>Interactive message actions</span>
              <Badge variant="outline" className="px-1 py-0 text-[10px]">
                Not available yet
              </Badge>
            </Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {["Acknowledgment", "Photo upload", "GPS location"].map((action) => (
                <div
                  key={action}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-2.5 opacity-70"
                >
                  <Checkbox checked={false} disabled aria-label={`${action} not available yet`} />
                  <span className="text-[11px] text-muted-foreground">
                    {action} · Not available yet
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
