"use client";

import React, { useState } from "react";
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
  Menu,
  ChevronDown,
  Eye,
  Database,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MobileNav() {
  const pathname = usePathname();
  const { activePersona, setPersonaId } = useApp();
  const [open, setOpen] = useState(false);

  if (pathname === "/login") {
    return null;
  }

  const isLinkActive = (path: string) => {
    if (path === "/" || path === "/coverage") {
      return pathname === "/" || pathname === "/coverage";
    }
    return pathname.startsWith(path);
  };

  const isSettingsAllowed =
    activePersona.role === "Party · National" || activePersona.role === "Admin";

  return (
    <header className="md:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
      {/* Main Top Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-emerald-700 text-white font-bold flex items-center justify-center text-xs shadow-xs">
            PU
          </div>
          <div>
            <div className="font-semibold text-xs leading-tight text-foreground flex items-center gap-1">
              PU App
              <span className="text-[9px] px-1 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                v1
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">
              {activePersona.label}
            </div>
          </div>
        </div>

        {/* Action Controls: Persona Switcher Pill & Hamburger Menu */}
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger className="text-[11px] font-medium bg-muted/60 border border-border px-2 py-1 rounded-md flex items-center gap-1 max-w-[130px] truncate">
              <Eye className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="truncate">{activePersona.role.split(" · ")[0]}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel className="text-xs">
                Switch Role Scope
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {PERSONAS.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => setPersonaId(p.id)}
                  className={`text-xs ${
                    activePersona.id === p.id
                      ? "bg-accent text-accent-foreground font-semibold"
                      : ""
                  }`}
                >
                  <div className="flex flex-col">
                    <span>{p.label}</span>
                    <span className="text-[10px] text-muted-foreground">{p.name}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Drawer Menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Menu className="w-4 h-4" />
                <span className="sr-only">Toggle navigation</span>
              </Button>
            } />
            <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
              <SheetHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-md bg-emerald-700 text-white font-bold flex items-center justify-center text-xs">
                    PU
                  </div>
                  <div>
                    <SheetTitle className="text-xs font-bold leading-tight">
                      NDC Polling Unit App
                    </SheetTitle>
                    <div className="text-[10px] text-muted-foreground">
                      Navigation Menu
                    </div>
                  </div>
                </div>
              </SheetHeader>

              {/* Persona Context in Drawer */}
              <div className="p-3 bg-muted/30 border-b border-border text-xs">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
                  Active Persona
                </div>
                <div className="font-semibold text-foreground">
                  {activePersona.label}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {activePersona.name}
                </div>
              </div>

              {/* Nav links */}
              <nav className="flex-1 overflow-y-auto p-3 space-y-4">
                <div>
                  <div className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Polling Units
                  </div>
                  <div className="space-y-1">
                    <Link
                      href="/coverage"
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium ${
                        isLinkActive("/coverage")
                          ? "bg-emerald-600 text-white"
                          : "hover:bg-accent"
                      }`}
                    >
                      <MapPin className="w-4 h-4" />
                      <span>Coverage</span>
                    </Link>
                    <Link
                      href="/candidates"
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium ${
                        isLinkActive("/candidates")
                          ? "bg-emerald-600 text-white"
                          : "hover:bg-accent"
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      <span>NDC candidates</span>
                    </Link>
                    <Link
                      href="/agents"
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium ${
                        isLinkActive("/agents")
                          ? "bg-emerald-600 text-white"
                          : "hover:bg-accent"
                      }`}
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Agents</span>
                    </Link>
                  </div>
                </div>

                <div>
                  <div className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Messaging
                  </div>
                  <div className="space-y-1">
                    <Link
                      href="/broadcasts"
                      onClick={() => setOpen(false)}
                      className={`flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium ${
                        isLinkActive("/broadcasts") && pathname !== "/broadcasts/new"
                          ? "bg-emerald-600 text-white"
                          : "hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Radio className="w-4 h-4" />
                        <span>Broadcasts</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        4 sent
                      </Badge>
                    </Link>
                    <Link
                      href="/broadcasts/new"
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium ${
                        pathname === "/broadcasts/new"
                          ? "bg-emerald-600 text-white"
                          : "hover:bg-accent"
                      }`}
                    >
                      <Send className="w-4 h-4" />
                      <span>New broadcast</span>
                    </Link>
                    <Link
                      href="/recipients"
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium ${
                        isLinkActive("/recipients")
                          ? "bg-emerald-600 text-white"
                          : "hover:bg-accent"
                      }`}
                    >
                      <Contact className="w-4 h-4" />
                      <span>Recipients</span>
                    </Link>
                  </div>
                </div>

                {isSettingsAllowed && (
                  <div>
                    <div className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Settings
                    </div>
                    <div className="space-y-1">
                      <Link
                        href="/settings"
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium ${
                          isLinkActive("/settings")
                            ? "bg-emerald-600 text-white"
                            : "hover:bg-accent"
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Groups and access</span>
                      </Link>
                    </div>
                  </div>
                )}
              </nav>

              <div className="p-3 border-t border-border bg-muted/20 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1 font-medium text-foreground">
                  <Database className="w-3 h-3 text-emerald-600" />
                  <span>INEC real data</span>
                </div>
                <p>DUMMY sample for wireframe demo</p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
