"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, usePermissions, useLogout } from "@/lib/hooks/use-auth";
import { useHasMounted } from "@/lib/hooks/use-has-mounted";
import {
  MapPin,
  Users,
  UserCheck,
  Radio,
  Send,
  Contact,
  Eye,
  LogOut,
  LogIn,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function Sidebar() {
  const pathname = usePathname();
  const hasMounted = useHasMounted();
  const { data: sessionData } = useSession();
  const { data: permissionsData } = usePermissions();
  const session = hasMounted ? sessionData : undefined;
  const permissions = hasMounted ? permissionsData : undefined;
  const logoutMutation = useLogout();

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

  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar text-sidebar-foreground h-screen sticky top-0 overflow-y-auto">
      {/* Brand Header */}
      <div className="p-4 border-b border-border/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-700 text-white font-bold flex items-center justify-center text-[15px] shadow-sm">
            PU
          </div>
          <div>
            <div className="font-semibold text-[15px] leading-tight text-foreground flex items-center gap-1.5">
              PU App
              <span className="text-[10.5px] font-normal px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                v1
              </span>
            </div>
            <div className="text-[11.5px] text-muted-foreground">
              NDC Campaign 2027
            </div>
          </div>
        </div>
      </div>

      {/* View As Persona Switcher */}
      <div className="p-3 border-b border-border/60 bg-muted/30">
        <div className="text-[10.5px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
          <Eye className="w-3.5 h-3.5 text-emerald-600" />
          View as
        </div>
        <button
          type="button"
          disabled
          title="Not available yet"
          className="w-full rounded-md border border-border bg-background p-2 text-left text-[13px] text-muted-foreground disabled:cursor-not-allowed disabled:opacity-70"
        >
          View as · Not available yet
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-5">
        {/* Polling Units Group */}
        {canManageCoverage && (
          <div>
            <div className="px-2 mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground/80">
              Polling Units
            </div>
            <div className="space-y-0.5">
              <Link
                href="/coverage"
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
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
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                  isLinkActive("/candidates")
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Candidates</span>
              </Link>
              <Link
                href="/agents"
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
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
        )}

        {/* Messaging Group */}
        {canBroadcast && (
          <div>
            <div className="px-2 mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground/80">
              Messaging
            </div>
            <div className="space-y-0.5">
              <Link
                href="/broadcasts"
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                  isLinkActive("/broadcasts") && pathname !== "/broadcasts/new"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Radio className="w-4 h-4 shrink-0" />
                  <span>Broadcasts</span>
                </div>
              </Link>
              <Link
                href="/broadcasts/new"
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
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
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
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
        )}

        {/* Settings Group (Party and Admin only). To restore it, bring back
            `const isAdmin = permissions?.isAdmin === true;` and the ShieldCheck and Layers icons. */}
        {/* {isAdmin && (
          <div>
            <div className="px-2 mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground/80">
              Settings
            </div>
            <div className="space-y-0.5">
              <Link
                href="/settings"
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                  isLinkActive("/settings")
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Groups and access</span>
              </Link>
              <Link
                href="/admin/queue"
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                  isLinkActive("/admin/queue")
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span>Job queues</span>
              </Link>
            </div>
          </div>
        )} */}
      </nav>

      {/* User Session Block */}
      <div className="p-3 border-t border-border/80 bg-muted/30">
        {session?.authenticated && session.person ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-foreground truncate flex items-center gap-1.5">
                <span className="truncate">{session.person.fullName}</span>
                {session.person.isAdmin && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1 py-0 h-4 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  >
                    Admin
                  </Badge>
                )}
              </div>
              <div className="text-[10.5px] text-muted-foreground truncate">
                {session.person.emailAddress}
              </div>
            </div>
            <button
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              title="Sign Out"
              className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 w-full py-1.5 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-medium transition-colors shadow-xs"
          >
            <LogIn className="w-4 h-4" />
            Sign in
          </Link>
        )}
      </div>

    </aside>
  );
}
