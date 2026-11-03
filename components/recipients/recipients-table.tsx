"use client";

import React from "react";
import { RecipientPerson } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Smartphone,
  AlertCircle,
  ExternalLink,
  MapPin,
  Lock,
  User,
  Send,
  Edit2,
} from "lucide-react";
import Link from "next/link";

interface RecipientsTableProps {
  recipients: RecipientPerson[];
}

export function RecipientsTable({
  recipients,
}: RecipientsTableProps) {
  if (recipients.length === 0) {
    return (
      <div className="p-12 text-center border border-dashed border-border rounded-xl bg-card space-y-2">
        <div className="w-10 h-10 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
          <User className="w-5 h-5" />
        </div>
        <div className="text-xs font-bold text-foreground">No personnel records found</div>
        <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
          No personnel match your selected filters. Try broadening your search or resetting
          filters.
        </p>
      </div>
    );
  }

  const renderChannelStatusBadge = (status: RecipientPerson["telegramStatus"]) => {
    switch (status) {
      case "Telegram connected":
        return (
          <Badge className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[11px] font-semibold gap-1 py-0.5">
            <Bot className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Telegram Connected</span>
          </Badge>
        );
      case "SMS only":
        return (
          <Badge className="bg-blue-600/10 text-blue-700 dark:text-blue-400 border-blue-500/20 text-[11px] font-semibold gap-1 py-0.5">
            <Smartphone className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <span>SMS Fallback</span>
          </Badge>
        );
      case "Number not matched":
        return (
          <Badge className="bg-amber-600/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[11px] font-semibold gap-1 py-0.5">
            <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>Not Matched</span>
          </Badge>
        );
      default:
        return null;
    }
  };

  const getGroupBadgeClass = (group: string) => {
    if (group.includes("President") || group.includes("Senate") || group.includes("Reps") || group.includes("Assembly")) {
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 font-bold";
    }
    if (group.toLowerCase().includes("official")) {
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-semibold";
    }
    return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20";
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold text-[11px]">
            <tr>
              <th className="py-3 px-4">Personnel & NDPA Contact</th>
              <th className="py-3 px-3">Role / Ticket</th>
              <th className="py-3 px-3">Jurisdiction / Polling Unit</th>
              <th className="py-3 px-3">Channel Readiness</th>
              <th className="py-3 px-3">Source Citation</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {recipients.map((person) => (
              <tr key={person.id} className="hover:bg-muted/30 transition-colors group">
                {/* Person Name & Masked Phone */}
                <td className="py-3.5 px-4 font-medium">
                  <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span>{person.name}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                    <Lock className="w-2.5 h-2.5 text-muted-foreground/60" />
                    <span>{person.phoneMasked}</span>
                  </div>
                </td>

                {/* Role / Group */}
                <td className="py-3.5 px-3 whitespace-nowrap">
                  <Badge
                    variant="outline"
                    className={`text-[11px] border ${getGroupBadgeClass(person.group)}`}
                  >
                    {person.group}
                  </Badge>
                </td>

                {/* Jurisdiction / Area */}
                <td className="py-3.5 px-3 min-w-[200px]">
                  <div className="flex items-center gap-1 text-foreground/90 font-medium text-xs">
                    <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="line-clamp-1">{person.area}</span>
                  </div>
                  {person.puCode && (
                    <span className="text-[10px] text-muted-foreground font-mono block mt-0.5">
                      PU Code: {person.puCode}
                    </span>
                  )}
                </td>

                {/* Telegram / SMS Status */}
                <td className="py-3.5 px-3 whitespace-nowrap">
                  {renderChannelStatusBadge(person.telegramStatus)}
                </td>

                {/* Source Citation */}
                <td className="py-3.5 px-3 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                  {person.source}
                </td>

                {/* Actions */}
                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled
                      className="h-7 px-2 text-xs text-muted-foreground gap-1"
                      title="Not available yet"
                    >
                      <Send className="w-3 h-3" />
                      <span className="hidden sm:inline">Ping: Not available yet</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      disabled
                      className="h-7 px-2 text-xs text-muted-foreground"
                      title="Not available yet"
                      aria-label="Edit details: Not available yet"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>

                    <Link
                      href="/coverage"
                      className="inline-flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground h-7 px-2 rounded-md hover:bg-muted transition-colors"
                      title="Inspect Polling Unit"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
