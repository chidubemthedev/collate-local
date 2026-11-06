"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, usePermissions, useLogout } from "@/lib/hooks/use-auth";
import { useHasMounted } from "@/lib/hooks/use-has-mounted";
import { NAV, NavIcon, ViewAsField, accessLabel, sectionOf, type NavSection } from "@/components/layout/nav";

/** Phone header from the wireframes: brand, View as, the two feature tabs, then the views inside the feature. */
export function MobileNav() {
  const pathname = usePathname();
  const hasMounted = useHasMounted();
  const { data: sessionData } = useSession();
  const { data: permissionsData } = usePermissions();
  const session = hasMounted ? sessionData : undefined;
  const permissions = hasMounted ? permissionsData : undefined;
  const logoutMutation = useLogout();
  // The tab tapped last, until the route changes, so the pill moves at the tap rather than when
  // the next page has loaded.
  const [tapped, setTapped] = useState<{ from: string; to: NavSection } | null>(null);

  if (pathname === "/login") {
    return null;
  }

  const sections: NavSection[] = [
    ...(permissions?.canManageCoverage === true ? (["pu"] as const) : []),
    ...(permissions?.canBroadcast === true ? (["msg"] as const) : []),
  ];
  const current = sectionOf(pathname);
  const subs = sections.includes(current) ? NAV[current].items : [];
  const shown = tapped && tapped.from === pathname ? tapped.to : current;
  const pillIndex = sections.indexOf(shown);

  return (
    <header className="flex flex-col gap-2.5 border-b border-[#E5E5E5] bg-white px-4 pt-3 pb-2 text-[#0A0A0A] md:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[8px] bg-[#1E8A55] text-[13px] font-bold text-white"
          >
            PU
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px] font-bold whitespace-nowrap">PU App</span>
            <span className="text-[11px] whitespace-nowrap text-[#737373]">NDC Campaign 2027</span>
          </span>
        </div>
        {session?.authenticated ? (
          // Same action as the sign-out button at the bottom of the desktop sidebar.
          <button
            type="button"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="inline-flex min-h-10 flex-none items-center gap-1.5 rounded-[8px] border border-[#E5E5E5] bg-white px-3 text-[13px] font-semibold text-[#525252] transition-[background-color,transform] duration-150 active:scale-[0.97] active:bg-[#F4F4F5] disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <NavIcon size={16} path="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            {logoutMutation.isPending ? "Signing out…" : "Sign out"}
          </button>
        ) : null}
        {session !== undefined && !session.authenticated ? (
          <Link
            href="/login"
            className="inline-flex min-h-10 items-center rounded-[8px] border border-[#E5E5E5] px-3 text-[13px] font-semibold text-[#0A0A0A] no-underline"
          >
            Sign in
          </Link>
        ) : null}

        {session?.authenticated ? (
          <div className="flex min-w-0 flex-[1_1_100%] flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#737373]">View as</span>
            <ViewAsField value={accessLabel(permissions?.roles, permissions?.isAdmin)} />
          </div>
        ) : null}

        {sections.length > 0 ? (
          <nav aria-label="Sections" className="relative flex flex-[1_1_100%] gap-1 rounded-[10px] bg-[#F0F0F0] p-1">
            {/* One white pill that slides to the chosen tab (each tab is 1/n of the row, 4px apart). */}
            {pillIndex >= 0 ? (
              <span
                aria-hidden="true"
                className="absolute top-1 bottom-1 left-1 rounded-[8px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                style={{
                  width: `calc((100% - 8px - ${(sections.length - 1) * 4}px) / ${sections.length})`,
                  transform: `translateX(calc(${pillIndex} * (100% + 4px)))`,
                }}
              />
            ) : null}
            {sections.map((key) => {
              const on = key === shown;
              return (
                <Link
                  key={key}
                  href={NAV[key].href}
                  aria-current={key === current ? "page" : undefined}
                  onClick={() => setTapped({ from: pathname, to: key })}
                  className={`relative flex min-h-11 flex-1 items-center justify-center rounded-[8px] text-[14px] font-semibold no-underline transition-colors duration-300 motion-reduce:transition-none ${
                    on ? "text-[#1E8A55] hover:text-[#1E8A55]" : "text-[#525252] hover:text-[#525252]"
                  }`}
                >
                  {NAV[key].label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </div>

      {subs.length > 0 ? (
        <nav aria-label={current === "pu" ? "Polling unit views" : "Messaging views"} className="flex min-w-0 gap-1 overflow-x-auto">
          {subs.map((item) => {
            const on = item.isActive(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-10 flex-none items-center rounded-[8px] px-3.5 text-[14px] whitespace-nowrap text-[#0A0A0A] no-underline hover:text-[#0A0A0A] ${
                  on ? "bg-[#F4F4F5] font-semibold" : ""
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}
