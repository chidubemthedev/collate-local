"use client";

import React, { useState, useEffect } from "react";
import { RecipientPerson } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATES_DATA, LGAS_DATA, WARDS_DATA } from "@/lib/data/inec-data";
import {
  UserPlus,
  ShieldCheck,
  Lock,
  CheckCircle2,
  Bot,
  Smartphone,
} from "lucide-react";

interface AddRecipientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRecipient: RecipientPerson | null;
  onSave: (recipient: RecipientPerson) => void;
}

export function AddRecipientModal({
  open,
  onOpenChange,
  editingRecipient,
  onSave,
}: AddRecipientModalProps) {
  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [group, setGroup] = useState<string>("Official agent");
  const [stateCode, setStateCode] = useState<string>("04");
  const [lgaCode, setLgaCode] = useState<string>("04-17");
  const [wardCode, setWardCode] = useState<string>("04-17-03");
  const [puCode, setPuCode] = useState<string>("04-17-03-004");
  const [area, setArea] = useState<string>("04-17-03-004 · Onuilo Ogbeodogwu Square");
  const [source, setSource] = useState<string>("Party Master Registry");
  const [telegramStatus, setTelegramStatus] = useState<
    "Telegram connected" | "SMS only" | "Number not matched"
  >("Telegram connected");

  useEffect(() => {
    if (editingRecipient) {
      setName(editingRecipient.name);
      setPhone(editingRecipient.phoneMasked || "");
      setGroup(editingRecipient.group);
      setStateCode(editingRecipient.stateCode || "04");
      setLgaCode(editingRecipient.lgaCode || "04-17");
      setWardCode(editingRecipient.wardCode || "04-17-03");
      setPuCode(editingRecipient.puCode || "");
      setArea(editingRecipient.area);
      setSource(editingRecipient.source);
      setTelegramStatus(editingRecipient.telegramStatus);
    } else {
      setName("");
      setPhone("+234 803 000 0000");
      setGroup("Official agent");
      setStateCode("04");
      setLgaCode("04-17");
      setWardCode("04-17-03");
      setPuCode("04-17-03-004");
      setArea("04-17-03-004 · Onuilo Ogbeodogwu Square");
      setSource("Party Master Registry");
      setTelegramStatus("Telegram connected");
    }
  }, [editingRecipient, open]);

  // Mask phone for NDPA compliance preview
  const maskPhone = (raw: string) => {
    const cleaned = raw.trim();
    if (cleaned.startsWith("+234 ••• •••")) return cleaned;
    const last3 = cleaned.slice(-3);
    return `+234 ••• ••• ${last3 || "000"}`;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newPerson: RecipientPerson = {
      id: editingRecipient ? editingRecipient.id : `rec-${Date.now()}`,
      name: name.trim(),
      group,
      area: puCode ? `${puCode} · ${area.split("·")[1]?.trim() || area}` : area,
      phoneMasked: maskPhone(phone),
      telegramStatus,
      source,
      stateCode,
      lgaCode,
      wardCode,
      puCode,
    };

    onSave(newPerson);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
        <form onSubmit={handleFormSubmit}>
          {/* Header */}
          <div className="p-5 border-b border-border bg-muted/20">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs font-semibold bg-background">
                {editingRecipient ? "Edit Personnel" : "New Personnel Registration"}
              </Badge>
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              {editingRecipient ? "Edit Recipient Record" : "Register Recipient or Agent"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Add personnel to the NDC messaging and election directory with automated channel
              verification.
            </DialogDescription>
          </div>

          {/* Form Body */}
          <div className="p-5 space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Full Name</Label>
              <Input
                type="text"
                placeholder="e.g. Chidubem Okafor"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-9 text-xs bg-background"
              />
            </div>

            {/* Role / Group & Source */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Role / Group</Label>
                <Select value={group} onValueChange={(val) => val && setGroup(val)}>
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Official agent">Official Party Agent</SelectItem>
                    <SelectItem value="Extra agent · Party">Extra Agent · Party</SelectItem>
                    <SelectItem value="Extra agent · Reps Ticket">Extra Agent · Reps Ticket</SelectItem>
                    <SelectItem value="Extra agent · Senate Ticket">Extra Agent · Senate Ticket</SelectItem>
                    <SelectItem value="NDC · Senate">NDC · Senate Candidate</SelectItem>
                    <SelectItem value="NDC · House of Reps">NDC · House of Reps Candidate</SelectItem>
                    <SelectItem value="NDC · State Assembly">NDC · State Assembly Candidate</SelectItem>
                    <SelectItem value="Ward Coordinator">Ward Coordinator</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Source Reference</Label>
                <Select value={source} onValueChange={(val) => val && setSource(val)}>
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Party Master Registry">Party Master Registry</SelectItem>
                    <SelectItem value="INEC list, p.14">INEC Official List (Verified)</SelectItem>
                    <SelectItem value="Mobilisation Team">Mobilisation Field Registry</SelectItem>
                    <SelectItem value="Constituency Office">Constituency Office</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Phone & NDPA Privacy Notice */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Contact Phone Number</Label>
                <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  NDPA 2023 Masked Preview: {maskPhone(phone)}
                </span>
              </div>
              <Input
                type="text"
                placeholder="e.g. 08031234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-9 text-xs bg-background font-mono"
              />
            </div>

            {/* Polling Unit / Area */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">PU Code</Label>
                <Input
                  type="text"
                  placeholder="e.g. 04-17-03-004"
                  value={puCode}
                  onChange={(e) => setPuCode(e.target.value)}
                  className="h-9 text-xs bg-background font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Channel Readiness</Label>
                <Select
                  value={telegramStatus}
                  onValueChange={(val) => val && setTelegramStatus(val as any)}
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Telegram connected">Telegram Connected</SelectItem>
                    <SelectItem value="SMS only">SMS Fallback Ready</SelectItem>
                    <SelectItem value="Number not matched">Number Not Matched</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Area Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Location / Jurisdiction Name</Label>
              <Input
                type="text"
                placeholder="e.g. Onuilo Ogbeodogwu Square, Inland Town I"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="h-9 text-xs bg-background"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border bg-muted/10 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              size="sm"
              className="text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              <span>{editingRecipient ? "Save Changes" : "Register Recipient"}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
