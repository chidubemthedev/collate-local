"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, usePermissions } from "@/lib/hooks/use-auth";
import {
  MapPin,
  Users,
  UserCheck,
  Radio,
  Send,
  Contact,
  ShieldCheck,
  Layers,
  Menu,
  Eye,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { data: permissions } = usePermissions();
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

  const canManageCoverage = permissions?.canManageCoverage === true;
  const canBroadcast = permissions?.canBroadcast === true;
  const isAdmin = permissions?.isAdmin === true;
  const roleLabel =
    permissions?.roles.join(", ") || (isAdmin ? "Admin" : "Account");

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
              {roleLabel}
            </div>
          </div>
        </div>

        {/* Access scope and hamburger menu */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Not available yet"
            className="h-8 px-2 text-[10px]"
          >
            <Eye className="w-3 h-3" />
            View as · Not available yet
          </Button>

          {/* Drawer Menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="w-4 h-4" />
                  <span className="sr-only">Toggle navigation</span>
                </Button>
              }
            />
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

              {/* Authenticated account in drawer */}
              <div className="p-3 bg-muted/30 border-b border-border text-xs">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
                  Current access
                </div>
                <div className="font-semibold text-foreground">{roleLabel}</div>
                <div className="text-[11px] text-muted-foreground">
                  {session?.authenticated
                    ? "Signed-in account"
                    : "Not signed in"}
                </div>
              </div>

              {/* Nav links */}
              <nav className="flex-1 overflow-y-auto p-3 space-y-4">
                {canManageCoverage && (
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
                        <span>Candidates</span>
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
                )}

                {canBroadcast && (
                  <div>
                    <div className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Messaging
                    </div>
                    <div className="space-y-1">
                      <Link
                        href="/broadcasts"
                        onClick={() => setOpen(false)}
                        className={`flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium ${
                          isLinkActive("/broadcasts") &&
                          pathname !== "/broadcasts/new"
                            ? "bg-emerald-600 text-white"
                            : "hover:bg-accent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Radio className="w-4 h-4" />
                          <span>Broadcasts</span>
                        </div>
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
                )}

                {/* {isAdmin && (
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
                    <Link
                      href="/admin/queue"
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium ${
                        isLinkActive("/admin/queue")
                          ? "bg-emerald-600 text-white"
                          : "hover:bg-accent"
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      <span>Job queues</span>
                    </Link>
                  </div>
                )} */}
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
