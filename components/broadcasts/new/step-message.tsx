"use client";

import React, { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Sparkles,
  CheckCircle2,
  Camera,
  MapPin,
  MessageSquare,
  Zap,
  Info,
} from "lucide-react";

export interface MessageConfig {
  title: string;
  body: string;
  hasAcknowledgeButton: boolean;
  acknowledgeButtonText: string;
  hasPhotoUploadButton: boolean;
  photoUploadButtonText: string;
  hasGpsButton: boolean;
  gpsButtonText: string;
}

interface StepMessageProps {
  message: MessageConfig;
  onChange: (updated: MessageConfig) => void;
}

const TEMPLATES = [
  {
    id: "gap-alert",
    name: "PU Coverage Gap Alert",
    title: "Urgent Polling Unit Coverage Gap Alert",
    content: `🚨 *URGENT NDC POLLING UNIT GAP ALERT* 🚨\n\nHello {{recipient_name}},\n\nOur live audit shows that several Polling Units in your area (*{{area_name}}*) have NO official party agent assigned.\n\n⚠️ Please coordinate with your Ward Coordinator immediately to nominate verified agents.\n\nTap [ Confirm Received ] below to log your acknowledgment.`,
    hasAck: true,
    hasPhoto: false,
    hasGps: false,
  },
  {
    id: "accreditation-check",
    name: "06:00 WAT Accreditation Drill",
    title: "Election-Day Opening & BVAS Check",
    content: `📋 *NDC ELECTION-DAY DIRECTIVE*\n\nTo all NDC Polling Unit Agents:\n1. Arrive at {{pu_code}} ({{pu_name}}) by 06:30 WAT.\n2. Inspect BVAS zero counter before polling starts.\n3. Report any late INEC arrival immediately to the Situation Room.\n\nTap [ Acknowledge & Verify ] below.`,
    hasAck: true,
    hasPhoto: false,
    hasGps: true,
  },
  {
    id: "ec8a-drill",
    name: "EC8A Result Sheet Photo Drill",
    title: "Form EC8A Result Upload Drill",
    content: `📸 *NATIONAL EC8A RESULT UPLOAD DRILL*\n\nTo all Official Agents:\nWhen voting closes at {{pu_code}}:\n1. Photograph Form EC8A clearly with all four corners visible.\n2. Verify Presiding Officer and Police signatures are legible.\n3. Upload the photo directly via the button below.`,
    hasAck: false,
    hasPhoto: true,
    hasGps: false,
  },
  {
    id: "security-sos",
    name: "Security SOS Protocol",
    title: "Security Rapid Response & Hotline Channel",
    content: `🛡️ *SECURITY DIRECTIVE & SOS INTERVENTION*\n\nIf you experience intimidation or ballot disruption at {{pu_code}}:\n1. Move to a secure location.\n2. Tap the emergency trigger below to alert the National Legal & Security Rapid Intervention Unit.\n3. National Hotline: 0800-NDC-HELP (0800-632-4357).`,
    hasAck: true,
    hasPhoto: true,
    hasGps: true,
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

  // Character & SMS segment computation
  const charLength = message.body.length;
  const smsSegments = charLength === 0 ? 0 : charLength <= 160 ? 1 : Math.ceil(charLength / 153);

  const handleApplyTemplate = (tmpl: (typeof TEMPLATES)[0]) => {
    onChange({
      ...message,
      title: tmpl.title,
      body: tmpl.content,
      hasAcknowledgeButton: tmpl.hasAck,
      hasPhotoUploadButton: tmpl.hasPhoto,
      hasGpsButton: tmpl.hasGps,
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
                <div className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                  {tmpl.title}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 2. Message Composer */}
      <Card className="border-border/80 shadow-xs bg-card">
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Campaign Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Campaign Internal Title</Label>
            <Input
              type="text"
              placeholder="e.g. Election-Eve Briefing & Accreditation Checklist"
              value={message.title}
              onChange={(e) => onChange({ ...message, title: e.target.value })}
              className="h-9 text-xs bg-background"
            />
          </div>

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
              <Label className="text-xs font-semibold">Message Body (Markdown Supported)</Label>
              <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-2">
                <span>{charLength} chars</span>
                <span>•</span>
                <span>{smsSegments} SMS {smsSegments === 1 ? "segment" : "segments"}</span>
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

          {/* Interactive Bot Action Buttons */}
          <div className="space-y-2 pt-2 border-t border-border">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <span>Interactive Telegram Inline Action Buttons</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-primary/5 text-primary border-primary/20">
                Boosts Acknowledgment
              </Badge>
            </Label>

            <div className="space-y-2.5 pt-1">
              {/* 1. Tap OK Button */}
              <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/20">
                <Checkbox
                  checked={message.hasAcknowledgeButton}
                  onCheckedChange={(checked) =>
                    onChange({ ...message, hasAcknowledgeButton: !!checked })
                  }
                />
                <div className="flex-1 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <Input
                    type="text"
                    value={message.acknowledgeButtonText}
                    onChange={(e) =>
                      onChange({ ...message, acknowledgeButtonText: e.target.value })
                    }
                    disabled={!message.hasAcknowledgeButton}
                    placeholder="Button Text: Confirm Received (Tap OK)"
                    className="h-8 text-xs bg-background max-w-sm"
                  />
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    Logs instant acknowledgment in live delivery dashboard.
                  </span>
                </div>
              </div>

              {/* 2. Photo Upload Button */}
              <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/20">
                <Checkbox
                  checked={message.hasPhotoUploadButton}
                  onCheckedChange={(checked) =>
                    onChange({ ...message, hasPhotoUploadButton: !!checked })
                  }
                />
                <div className="flex-1 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <Input
                    type="text"
                    value={message.photoUploadButtonText}
                    onChange={(e) =>
                      onChange({ ...message, photoUploadButtonText: e.target.value })
                    }
                    disabled={!message.hasPhotoUploadButton}
                    placeholder="Button Text: 📸 Upload Form EC8A Photo"
                    className="h-8 text-xs bg-background max-w-sm"
                  />
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    Prompts agent to open camera and submit stamped EC8A result.
                  </span>
                </div>
              </div>

              {/* 3. GPS Location Button */}
              <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/20">
                <Checkbox
                  checked={message.hasGpsButton}
                  onCheckedChange={(checked) =>
                    onChange({ ...message, hasGpsButton: !!checked })
                  }
                />
                <div className="flex-1 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <Input
                    type="text"
                    value={message.gpsButtonText}
                    onChange={(e) => onChange({ ...message, gpsButtonText: e.target.value })}
                    disabled={!message.hasGpsButton}
                    placeholder="Button Text: 📍 Verify GPS Coordinates"
                    className="h-8 text-xs bg-background max-w-sm"
                  />
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    Requests real-time polling unit location geo-stamp.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
