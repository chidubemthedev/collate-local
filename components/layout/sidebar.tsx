"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/context/app-context";
import { PERSONAS } from "@/lib/tree-permissions";
import {
  MapPin,
  Users,
  UserCheck,
  Radio,
  Send,
  Contact,
  ShieldCheck,
  ChevronDown,
  Layers,
  Database,
  Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Sidebar() {
  const pathname = usePathname();
  const { activePersona, setPersonaId } = useApp();

  const isLinkActive = (path: string) => {
    if (path === "/" || path === "/coverage") {
      return pathname === "/" || pathname === "/coverage";
    }
    return pathname.startsWith(path);
  };

  const isSettingsAllowed =
    activePersona.role === "Party · National" || activePersona.role === "Admin";

  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar text-sidebar-foreground h-screen sticky top-0 overflow-y-auto">
      {/* Brand Header */}
      <div className="p-4 border-b border-border/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-700 text-white font-bold flex items-center justify-center text-sm shadow-sm">
            PU
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight text-foreground flex items-center gap-1.5">
              PU App
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                v1
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">NDC Campaign 2027</div>
          </div>
        </div>
      </div>

      {/* View As Persona Switcher */}
      <div className="p-3 border-b border-border/60 bg-muted/30">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
          <Eye className="w-3 h-3 text-emerald-600" />
          View as
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full text-left bg-background border border-border hover:bg-accent rounded-md p-2 flex items-center justify-between text-xs transition-colors shadow-xs">
            <div className="truncate pr-2">
              <div className="font-medium text-foreground truncate">
                {activePersona.label}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {activePersona.name}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" align="start">
            <DropdownMenuLabel className="text-xs font-semibold">
              Simulate Hierarchy & Permissions
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {PERSONAS.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => setPersonaId(p.id)}
                className={`text-xs py-1.5 cursor-pointer flex flex-col items-start ${
                  activePersona.id === p.id
                    ? "bg-accent text-accent-foreground font-medium"
                    : ""
                }`}
              >
                <span className="font-medium">{p.label}</span>
                <span className="text-[10px] text-muted-foreground">{p.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-5">
        {/* Polling Units Group */}
        <div>
          <div className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
            Polling Units
          </div>
          <div className="space-y-0.5">
            <Link
              href="/coverage"
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isLinkActive("/coverage")
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <MapPin className="w-4 h-4 shrink-0" />
              <span>Coverage</span>
            </Link>
            <Link
              href="/candidates"
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isLinkActive("/candidates")
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>NDC candidates</span>
            </Link>
            <Link
              href="/agents"
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isLinkActive("/agents")
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>Agents</span>
            </Link>
          </div>
        </div>

        {/* Messaging Group */}
        <div>
          <div className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
            Messaging
          </div>
          <div className="space-y-0.5">
            <Link
              href="/broadcasts"
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isLinkActive("/broadcasts") && pathname !== "/broadcasts/new"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Radio className="w-4 h-4 shrink-0" />
                <span>Broadcasts</span>
              </div>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0">
                4 sent
              </Badge>
            </Link>
            <Link
              href="/broadcasts/new"
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                pathname === "/broadcasts/new"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Send className="w-4 h-4 shrink-0" />
              <span>New broadcast</span>
            </Link>
            <Link
              href="/recipients"
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isLinkActive("/recipients")
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Contact className="w-4 h-4 shrink-0" />
              <span>Recipients</span>
            </Link>
          </div>
        </div>

        {/* Settings Group (Party and Admin only) */}
        {isSettingsAllowed && (
          <div>
            <div className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
              Settings
            </div>
            <div className="space-y-0.5">
              <Link
                href="/settings"
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isLinkActive("/settings")
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Groups and access</span>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Footer data disclaimer matching wireframe */}
      <div className="p-3 border-t border-border/60 bg-muted/20 text-[11px] text-muted-foreground space-y-1">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Database className="w-3.5 h-3.5 text-emerald-600" />
          <span>INEC real data</span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-normal">
          DUMMY sample coverage for the wireframe demo.
        </p>
      </div>
    </aside>
  );
}
