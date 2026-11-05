"use client";

import React, { useState } from "react";
import { AuditLogEntry, CandidateAccessLink } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Lock, ShieldCheck, Copy, Download, Key } from "lucide-react";
import { CANDIDATE_ACCESS_LINKS_DATA, AUDIT_LOG_DATA, CHANNEL_GATEWAY_CONFIG } from "@/lib/data/settings-data";

export function SecurityPrivacySettings() {
  const [phoneMasking, setPhoneMasking] = useState(CHANNEL_GATEWAY_CONFIG.ndpa.phoneMaskingEnabled);
  const [candidateLinks] = useState<CandidateAccessLink[]>(CANDIDATE_ACCESS_LINKS_DATA);
  const [auditLogs] = useState<AuditLogEntry[]>(AUDIT_LOG_DATA);

  const handleExportAuditLogs = () => {
    const csvHeader = "ID,Timestamp,Actor,Role,Action,Target,IPAddress,Status\n";
    const csvRows = auditLogs
      .map(
        (log) =>
          `"${log.id}","${log.timestamp}","${log.actor}","${log.role}","${log.action}","${log.target}","${log.ipAddress}","${log.status}"`
      )
      .join("\n");
    const blob = new Blob([csvHeader + csvRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `ndc-security-audit-log-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* NDPA 2023 Secrecy Banner & Controls */}
      <Card className="border-purple-200 bg-purple-50/30 shadow-xs">
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-purple-950">
                  Nigeria Data Protection Act (NDPA 2023) & Agent Secrecy
                </CardTitle>
                <CardDescription className="text-xs text-purple-800/80">
                  Compliance with s.28 (DPIA), s.30 (Sensitive Political Data), and s.39 (Security of Processing)
                </CardDescription>
              </div>
            </div>
            <Badge className="bg-purple-800 hover:bg-purple-800 text-white text-[11px] font-semibold">
              DPIA Filed (s.28)
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Phone Masking Switch */}
            <div className="p-3.5 bg-white rounded-lg border border-purple-100 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">Agent Phone Masking</span>
                  <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 text-[10px]">
                    +234 ••• ••• XXXX
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500">
                  Masks phone numbers across candidate, coordinator, and public screens.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPhoneMasking(!phoneMasking)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  phoneMasking ? "bg-purple-800" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    phoneMasking ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Candidate Bulk Export Lockdown */}
            <div className="p-3.5 bg-white rounded-lg border border-purple-100 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">Candidate Bulk Export Lockdown</span>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px]">
                    Enforced
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500">
                  Prevents candidates from extracting full contact lists before election day.
                </p>
              </div>
              <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Candidate Personal Access Links Section */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Key className="h-4 w-4 text-amber-600" />
              <span>Candidate Personal Access Links (No Password / &ldquo;View As&rdquo;)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Each candidate receives a revocable token link scoped to their constituency subtree.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-200">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-700">Candidate / Office</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Constituency Seat</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Personal Token URL</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Expires</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Status</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-700">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {candidateLinks.map((link) => {
                  return (
                    <TableRow key={link.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="py-2.5">
                        <div className="font-bold text-xs text-slate-900">{link.candidateName}</div>
                        <div className="text-[11px] text-slate-500">{link.office}</div>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-slate-800 font-medium">
                        {link.seat}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-1.5 max-w-xs">
                          <span className="text-[11px] text-slate-500 italic">Not available yet</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled
                            className="h-6 w-6 p-0 text-slate-500"
                            title="Not available yet"
                            aria-label="Copy link: Not available yet"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-slate-600">
                        {link.expiresAt}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold ${
                            link.status === "Active"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : link.status === "Expired"
                              ? "bg-slate-100 text-slate-600 border-slate-200"
                              : "bg-red-50 text-red-800 border-red-200"
                          }`}
                        >
                          {link.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                          className="h-7 px-2 text-[11px] text-slate-500"
                          title="Not available yet"
                        >
                          Not available yet
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Security Audit Trail Table */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Immutable Security Audit Log</span>
              <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700">
                {auditLogs.length} Events Displayed
              </Badge>
            </h3>
            <p className="text-xs text-slate-500">
              Tracks token link generation, exports, broadcast dispatches, and verification activities.
            </p>
          </div>

          <Button
            onClick={handleExportAuditLogs}
            size="sm"
            variant="outline"
            className="h-8 text-xs font-medium text-slate-700 gap-1.5 self-start md:self-auto"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Audit CSV</span>
          </Button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-200">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-700">Timestamp</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Actor / Role</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Action Performed</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Target Resource</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">IP / Geo</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-700">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="py-2 text-[11px] font-mono text-slate-500 whitespace-nowrap">
                      {log.timestamp}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="text-xs font-bold text-slate-900">{log.actor}</div>
                      <div className="text-[10px] text-slate-500">{log.role}</div>
                    </TableCell>
                    <TableCell className="py-2 text-xs font-medium text-slate-800">
                      {log.action}
                    </TableCell>
                    <TableCell className="py-2 text-xs text-slate-600">
                      {log.target}
                    </TableCell>
                    <TableCell className="py-2 text-[11px] font-mono text-slate-500">
                      {log.ipAddress}
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${
                          log.status === "Success"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : log.status === "Warning"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-red-50 text-red-800 border-red-200"
                        }`}
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
