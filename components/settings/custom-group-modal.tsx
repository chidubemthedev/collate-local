"use client";

import React, { useState, useEffect } from "react";
import { AccessGroup } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Send, Filter, Eye, LogIn, CheckCircle2 } from "lucide-react";

interface CustomGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (group: AccessGroup) => void;
  initialGroup?: AccessGroup | null;
}

export function CustomGroupModal({
  isOpen,
  onClose,
  onSave,
  initialGroup,
}: CustomGroupModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [membersDescription, setMembersDescription] = useState("");
  const [membersCount, setMembersCount] = useState<number>(10);
  const [canMessage, setCanMessage] = useState("Down the tree");
  const [filterPolitical, setFilterPolitical] = useState(true);
  const [filterLGA, setFilterLGA] = useState(true);
  const [filterWard, setFilterWard] = useState(true);
  const [filterPU, setFilterPU] = useState(false);
  const [seesCoverageFor, setSeesCoverageFor] = useState("Assigned State PUs");
  const [logsIn, setLogsIn] = useState("Web app (Email + OTP)");

  useEffect(() => {
    if (initialGroup) {
      setName(initialGroup.name);
      setDescription(initialGroup.description || "");
      setMembersDescription(initialGroup.membersDescription || "");
      setMembersCount(initialGroup.membersCount || 10);
      setCanMessage(initialGroup.canMessage);
      setFilterPolitical(initialGroup.canFilterBy.includes("Political"));
      setFilterLGA(initialGroup.canFilterBy.includes("LGA"));
      setFilterWard(initialGroup.canFilterBy.includes("Ward") || initialGroup.canFilterBy.includes("wards"));
      setFilterPU(initialGroup.canFilterBy.includes("PU"));
      setSeesCoverageFor(initialGroup.seesCoverageFor);
      setLogsIn(initialGroup.logsIn);
    } else {
      setName("");
      setDescription("");
      setMembersDescription("");
      setMembersCount(10);
      setCanMessage("Down the tree");
      setFilterPolitical(true);
      setFilterLGA(true);
      setFilterWard(true);
      setFilterPU(false);
      setSeesCoverageFor("Assigned State PUs");
      setLogsIn("Web app (Email + OTP)");
    }
  }, [initialGroup, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const filterList = [];
    if (filterPolitical) filterList.push("Political units");
    if (filterLGA) filterList.push("LGAs");
    if (filterWard) filterList.push("Wards");
    if (filterPU) filterList.push("Polling Units");
    const canFilterBy = filterList.length > 0 ? filterList.join(", ") : "—";

    const savedGroup: AccessGroup = {
      id: initialGroup?.id || `grp-custom-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      membersDescription: membersDescription.trim() || "Designated Campaign Personnel",
      membersCount: Number(membersCount) || 0,
      canMessage,
      canFilterBy,
      seesCoverageFor,
      logsIn,
      isSystem: false,
      createdAt: initialGroup?.createdAt || new Date().toISOString().split("T")[0],
    };

    onSave(savedGroup);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900">
                    {initialGroup ? "Edit Access Group" : "Create Custom Access Group"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Define custom tree permissions, geographic scoping, and messaging rights.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              {/* Group Name & Members */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="group-name" className="text-xs font-semibold text-slate-700">
                    Group Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="group-name"
                    placeholder="e.g. South-East Regional Directorate"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="members-count" className="text-xs font-semibold text-slate-700">
                    Estimated Members Count
                  </Label>
                  <Input
                    id="members-count"
                    type="number"
                    min="1"
                    placeholder="e.g. 25"
                    value={membersCount}
                    onChange={(e) => setMembersCount(parseInt(e.target.value) || 0)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Description & Members Scope */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="group-desc" className="text-xs font-semibold text-slate-700">
                    Purpose / Description
                  </Label>
                  <Input
                    id="group-desc"
                    placeholder="e.g. Field coordination for regional rallies & logistics"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="group-who" className="text-xs font-semibold text-slate-700">
                    Who Belongs Here
                  </Label>
                  <Input
                    id="group-who"
                    placeholder="e.g. Zonal field coordinators & liaison officers"
                    value={membersDescription}
                    onChange={(e) => setMembersDescription(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-4">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Inverted Tree Permission Rules</span>
                </h4>

                {/* Messaging Scope Selection */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Messaging Permission Scope
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                      {
                        value: "Down the tree (All candidates & agents in subtree)",
                        label: "Down the Subtree",
                        desc: "Message anyone strictly within overlapping political units",
                      },
                      {
                        value: "Everyone (Nationwide broadcast)",
                        label: "Everyone (National)",
                        desc: "Broadcast without geographic restriction",
                      },
                      {
                        value: "Candidates and agents strictly within their assigned State",
                        label: "State Subtree Only",
                        desc: "Restricted to assigned State PUs & agents",
                      },
                      {
                        value: "No one (Receive-only channel)",
                        label: "Receive Only (No Broadcast)",
                        desc: "Members cannot author or send broadcasts",
                      },
                    ].map((opt) => (
                      <div
                        key={opt.value}
                        onClick={() => setCanMessage(opt.value)}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                          canMessage === opt.value
                            ? "bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-bold text-slate-900">{opt.label}</span>
                          {canMessage === opt.value && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug">{opt.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Filter Permissions Checkboxes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Allowed Filter Dimensions
                  </Label>
                  <div className="flex flex-wrap gap-2.5">
                    {[
                      {
                        label: "Political Units (Senate / Reps / Assembly)",
                        checked: filterPolitical,
                        setter: setFilterPolitical,
                      },
                      { label: "LGAs", checked: filterLGA, setter: setFilterLGA },
                      { label: "Wards", checked: filterWard, setter: setFilterWard },
                      { label: "Polling Units", checked: filterPU, setter: setFilterPU },
                    ].map((item, idx) => (
                      <label
                        key={idx}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs cursor-pointer transition-all ${
                          item.checked
                            ? "bg-slate-900 text-white border-slate-900 font-medium"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(e) => item.setter(e.target.checked)}
                          className="sr-only"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Coverage Visibility & Login Method */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Sees Coverage For
                    </Label>
                    <select
                      value={seesCoverageFor}
                      onChange={(e) => setSeesCoverageFor(e.target.value)}
                      className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="National (176,846 PUs)">National (All 176,846 PUs)</option>
                      <option value="Assigned State PUs">Assigned State PUs</option>
                      <option value="Own constituency & below only">Own Constituency Subtree</option>
                      <option value="Extra agents distribution only">Extra Agents Distribution Only</option>
                      <option value="—">No Coverage View Access</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Login & Access Method
                    </Label>
                    <select
                      value={logsIn}
                      onChange={(e) => setLogsIn(e.target.value)}
                      className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="Web app (SSO / 2FA)">Web app (SSO / 2FA Authenticated)</option>
                      <option value="Web app (Email + OTP)">Web app (Email + OTP Magic Link)</option>
                      <option value="Personal token link (No password)">Personal Token Link (View As)</option>
                      <option value="No login · Telegram Bot (@NDCPollingUnitBot)">Telegram Bot Only (No Web Access)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs text-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium"
            >
              {initialGroup ? "Update Access Group" : "Create Access Group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
