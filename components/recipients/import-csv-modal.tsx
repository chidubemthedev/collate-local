"use client";

import React, { useState } from "react";
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
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Download,
  Lock,
} from "lucide-react";

interface ImportCSVModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: (imported: RecipientPerson[]) => void;
}

export function ImportCSVModal({
  open,
  onOpenChange,
  onImportSuccess,
}: ImportCSVModalProps) {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [fileUploaded, setFileUploaded] = useState<boolean>(false);

  const sampleRows: RecipientPerson[] = [
    {
      id: "imp-1",
      name: "Chukwuma Kingsley",
      group: "Official agent",
      area: "04-17-03-001 · D.M.G.S I",
      phoneMasked: "+234 ••• ••• 412",
      telegramStatus: "Telegram connected",
      source: "CSV Import Batch #104",
      puCode: "04-17-03-001",
    },
    {
      id: "imp-2",
      name: "Blessing Nnadozie",
      group: "Official agent",
      area: "04-17-03-002 · D.M.G.S II",
      phoneMasked: "+234 ••• ••• 893",
      telegramStatus: "Telegram connected",
      source: "CSV Import Batch #104",
      puCode: "04-17-03-002",
    },
    {
      id: "imp-3",
      name: "Pascal Okeke",
      group: "Extra agent · Party",
      area: "04-17-03-002 · D.M.G.S II",
      phoneMasked: "+234 ••• ••• 520",
      telegramStatus: "SMS only",
      source: "CSV Import Batch #104",
      puCode: "04-17-03-002",
    },
    {
      id: "imp-4",
      name: "Grace Nwosu",
      group: "Official agent",
      area: "04-17-03-003 · D.M.G.S III",
      phoneMasked: "+234 ••• ••• 119",
      telegramStatus: "Telegram connected",
      source: "CSV Import Batch #104",
      puCode: "04-17-03-003",
    },
  ];

  const handleFileUpload = () => {
    setFileUploaded(true);
  };

  const handleExecuteImport = () => {
    setIsProcessing(true);

    setTimeout(() => {
      onImportSuccess(sampleRows);
      setIsProcessing(false);
      setFileUploaded(false);
      onOpenChange(false);
    }, 1000);
  };

  const handleDownloadSampleTemplate = () => {
    const csvContent =
      "name,group,pu_code,location_name,phone,source\nChukwuma Kingsley,Official agent,04-17-03-001,D.M.G.S I,+2348031234567,Party Master Registry\nBlessing Nnadozie,Official agent,04-17-03-002,D.M.G.S II,+2348032345678,Party Master Registry";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "ndc-recipients-import-template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <div className="p-5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs font-semibold bg-background">
              Bulk Registration
            </Badge>
          </div>
          <DialogTitle className="text-lg font-bold text-foreground">
            Import Recipients from CSV or INEC List
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Bulk upload verified candidate rosters, official polling unit agents, and mobilisation
            teams.
          </DialogDescription>
        </div>

        <div className="p-5 space-y-4">
          {/* Dropzone */}
          {!fileUploaded ? (
            <div
              onClick={handleFileUpload}
              className="p-8 border-2 border-dashed border-border hover:border-primary/60 rounded-2xl bg-muted/10 hover:bg-primary/5 transition-all text-center cursor-pointer space-y-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">
                  Click to select CSV file or drag & drop here
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Accepts standard .CSV, .XLSX exported from INEC portal or NDC field forms.
                </p>
              </div>
              <Button variant="outline" size="sm" className="text-xs h-8">
                Select CSV File
              </Button>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>anambra-north-agents-roster-final.csv (4 records parsed)</span>
                </div>
                <Badge className="bg-emerald-600 text-white text-[10px]">Ready to Import</Badge>
              </div>

              {/* Sample preview table */}
              <div className="rounded-lg border border-border bg-background overflow-hidden text-xs">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-muted/60 text-muted-foreground font-semibold">
                    <tr>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-2">Role</th>
                      <th className="py-2 px-2">PU Code</th>
                      <th className="py-2 px-3">NDPA Masked Phone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {sampleRows.map((row) => (
                      <tr key={row.id}>
                        <td className="py-2 px-3 font-semibold">{row.name}</td>
                        <td className="py-2 px-2">{row.group}</td>
                        <td className="py-2 px-2 font-mono text-[10px]">{row.puCode}</td>
                        <td className="py-2 px-3 font-mono text-[10px] text-muted-foreground">
                          {row.phoneMasked}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  NDPA 2023 Secrecy rules auto-applied
                </span>
                <button
                  type="button"
                  onClick={() => setFileUploaded(false)}
                  className="text-primary hover:underline"
                >
                  Choose another file
                </button>
              </div>
            </div>
          )}

          {/* Download sample CSV template */}
          <div className="p-3 rounded-xl border border-border bg-muted/20 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="font-semibold text-foreground">Need standard CSV format?</span>
              <p className="text-[11px] text-muted-foreground">
                Download the official template with predefined headers for INEC matching.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadSampleTemplate}
              className="text-xs h-8 gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Sample CSV</span>
            </Button>
          </div>
        </div>

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
            type="button"
            size="sm"
            disabled={!fileUploaded || isProcessing}
            onClick={handleExecuteImport}
            className="text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            <span>{isProcessing ? "Processing Import..." : "Execute Bulk Import"}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
