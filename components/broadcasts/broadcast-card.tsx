"use client";

import React from "react";
import { BroadcastData } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Send,
  Clock,
  FileEdit,
  CheckCircle2,
  AlertTriangle,
  Eye,
  ExternalLink,
  Users,
  MapPin,
  CheckCheck,
  ChevronRight,
  MoreVertical,
  RotateCw,
  Copy,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";

interface BroadcastCardProps {
  broadcast: BroadcastData;
  onPreview: (broadcast: BroadcastData) => void;
}

export function BroadcastCard({ broadcast, onPreview }: BroadcastCardProps) {
  const router = useRouter();
  const isSent = broadcast.status === "Sent";
  const isScheduled = broadcast.status === "Scheduled";
  const isDraft = broadcast.status === "Draft";

  // Calculate segment widths for delivery bar
  const total = broadcast.sent || 1;
  const deliveredWidth = Math.min(100, Math.round((broadcast.delivered / total) * 100));
  const failedWidth = Math.min(100, Math.round((broadcast.failed / total) * 100));
  const pendingWidth = Math.min(100, Math.round((broadcast.pending / total) * 100));

  const totalRecipients = broadcast.candidatesCount + broadcast.agentsCount;

  return (
    <Card className="border-border/80 shadow-xs bg-card hover:border-primary/40 transition-all group overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Top Header: Status Badge, Channel, Timestamp, Menu */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Pill */}
            {isSent && (
              <Badge className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs font-semibold gap-1.5 py-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Sent & Delivered
              </Badge>
            )}
            {isScheduled && (
              <Badge className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 dark:text-blue-400 border-blue-500/20 text-xs font-semibold gap-1.5 py-0.5">
                <Clock className="w-3 h-3 text-blue-500" />
                Scheduled
              </Badge>
            )}
            {isDraft && (
              <Badge variant="outline" className="bg-muted text-muted-foreground text-xs font-medium gap-1.5 py-0.5">
                <FileEdit className="w-3 h-3" />
                Draft
              </Badge>
            )}

            {/* Channel Pill */}
            <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground bg-muted/40 border-border">
              {broadcast.channel}
            </Badge>

            {/* Sender Role Pill */}
            <Badge
              variant="outline"
              className={`text-[11px] font-medium border-border ${
                broadcast.senderRole.includes("Party")
                  ? "bg-primary/5 text-primary border-primary/20"
                  : broadcast.senderRole.includes("Candidate")
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {broadcast.senderRole}
            </Badge>
          </div>

          {/* Quick Context Menu */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
              {broadcast.sentAt}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <MoreVertical className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs">
                <DropdownMenuItem onClick={() => onPreview(broadcast)} className="gap-2 cursor-pointer">
                  <Eye className="w-3.5 h-3.5" />
                  Quick Preview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/broadcasts/${broadcast.id}`)} className="gap-2 cursor-pointer">
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Delivery Log
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/broadcasts/new?duplicate=${broadcast.id}`)} className="gap-2 cursor-pointer">
                  <Copy className="w-3.5 h-3.5" />
                  Duplicate Campaign
                </DropdownMenuItem>
                {broadcast.failed > 0 && (
                  <DropdownMenuItem disabled className="gap-2 text-muted-foreground">
                    <RotateCw className="w-3.5 h-3.5" />
                    Resend to {broadcast.failed} Failed: Not available yet
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 text-rose-600 dark:text-rose-400 cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Campaign
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Campaign Title & Geographic Target */}
        <div>
          <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
            {broadcast.title}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 flex-wrap">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="font-semibold text-foreground/90">{broadcast.targetArea}</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              <span>
                {totalRecipients.toLocaleString()} Recipients (
                {broadcast.candidatesCount > 0 && `${broadcast.candidatesCount} Candidates`}
                {broadcast.candidatesCount > 0 && broadcast.agentsCount > 0 && " + "}
                {broadcast.agentsCount > 0 && `${broadcast.agentsCount.toLocaleString()} Agents`})
              </span>
            </span>
          </div>
        </div>

        {/* Message Snippet */}
        {broadcast.messageContent && (
          <div className="text-xs text-muted-foreground/90 line-clamp-2 bg-muted/30 p-2.5 rounded-lg border border-border/50 font-sans italic">
            "{broadcast.messageContent.replace(/[#*`_]/g, "")}"
          </div>
        )}

        {/* Delivery Performance Bar (For Sent Broadcasts) */}
        {isSent && (
          <div className="space-y-2 pt-1 border-t border-border/60">
            {/* Metric Counters Header */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    Delivered: {broadcast.delivered.toLocaleString()} / {broadcast.sent.toLocaleString()} ({broadcast.deliveredPct}%)
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-semibold text-primary">
                <CheckCheck className="w-3.5 h-3.5" />
                <span>
                  Acknowledged: {broadcast.tappedOk.toLocaleString()} ({broadcast.tappedOkPct}%)
                </span>
              </div>
            </div>

            {/* Segmented Visual Progress Bar */}
            <div className="w-full h-2 rounded-full bg-muted/80 overflow-hidden flex">
              <div
                style={{ width: `${deliveredWidth}%` }}
                className="h-full bg-emerald-500 transition-all duration-500"
                title={`Delivered: ${broadcast.delivered}`}
              />
              <div
                style={{ width: `${pendingWidth}%` }}
                className="h-full bg-amber-400 transition-all duration-500"
                title={`Pending: ${broadcast.pending}`}
              />
              <div
                style={{ width: `${failedWidth}%` }}
                className="h-full bg-rose-500 transition-all duration-500"
                title={`Failed: ${broadcast.failed}`}
              />
            </div>

            {/* Footer mini-stats */}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Delivered: {broadcast.delivered}
                </span>
                {broadcast.pending > 0 && (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Pending: {broadcast.pending}
                  </span>
                )}
                {broadcast.failed > 0 && (
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Failed: {broadcast.failed}
                  </span>
                )}
              </div>

              <span className="text-[11px] text-muted-foreground sm:hidden">
                {broadcast.sentAt}
              </span>
            </div>
          </div>
        )}

        {/* Scheduled / Draft Meta Box */}
        {(isScheduled || isDraft) && (
          <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs flex items-center justify-between">
            <span className="text-muted-foreground">
              {isScheduled ? "Scheduled to trigger automatically at:" : "Status:"}
            </span>
            <span className="font-semibold text-foreground font-mono">
              {isScheduled ? broadcast.sentAt : "Draft saved (not sent)"}
            </span>
          </div>
        )}

        {/* Card Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPreview(broadcast)}
            className="text-xs h-8 text-muted-foreground hover:text-foreground"
          >
            <Eye className="w-3.5 h-3.5 mr-1.5 text-primary" />
            Quick Preview
          </Button>

          <Link
            href={`/broadcasts/${broadcast.id}`}
            className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-xs font-semibold transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 h-8 px-3"
          >
            <span>View Delivery Report</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
