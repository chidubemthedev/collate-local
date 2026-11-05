"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, usePermissions } from "@/lib/hooks/use-auth";
import { useHasMounted } from "@/lib/hooks/use-has-mounted";
import { NAV, ViewAsField, accessLabel, sectionOf, type NavSection } from "@/components/layout/nav";

/** Phone header from the wireframes: brand, View as, the two feature tabs, then the views inside the feature. */
export function MobileNav() {
  const pathname = usePathname();
  const hasMounted = useHasMounted();
  const { data: sessionData } = useSession();
  const { data: permissionsData } = usePermissions();
  const session = hasMounted ? sessionData : undefined;
  const permissions = hasMounted ? permissionsData : undefined;

  if (pathname === "/login") {
    return null;
  }

  const sections: NavSection[] = [
    ...(permissions?.canManageCoverage === true ? (["pu"] as const) : []),
    ...(permissions?.canBroadcast === true ? (["msg"] as const) : []),
  ];
  const current = sectionOf(pathname);
  const subs = sections.includes(current) ? NAV[current].items : [];

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
        {!session?.authenticated ? (
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
          <nav aria-label="Sections" className="flex flex-[1_1_100%] gap-1 rounded-[10px] bg-[#F0F0F0] p-1">
            {sections.map((key) => {
              const on = key === current;
              return (
                <Link
                  key={key}
                  href={NAV[key].href}
                  aria-current={on ? "page" : undefined}
                  className={`flex min-h-11 flex-1 items-center justify-center rounded-[8px] text-[14px] font-semibold no-underline ${
                    on ? "bg-white text-[#1E8A55] shadow-[0_1px_2px_rgba(0,0,0,0.12)] hover:text-[#1E8A55]" : "text-[#525252] hover:text-[#525252]"
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
