"use client";

import React from "react";
import { useApp } from "@/lib/context/app-context";
import { Eye, ShieldAlert, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ViewAsBar() {
  const { activePersona, setPersonaId } = useApp();

  // If viewing as default Party National or Admin, don't show the warning banner, just subtle indicator
  if (activePersona.role === "Party · National") {
    return null;
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
        <Eye className="w-4 h-4 text-amber-600 shrink-0" />
        <div>
          <span className="font-semibold">Scoped View: </span>
          <span>{activePersona.label}</span>
          <span className="hidden sm:inline text-muted-foreground ml-1">
            — {activePersona.description}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPersonaId("persona-party-national")}
          className="h-6 text-[11px] px-2 border-amber-500/40 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200"
        >
          Reset to Party National
        </Button>
      </div>
    </div>
  );
}
