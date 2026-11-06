"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, usePermissions, useLogout } from "@/lib/hooks/use-auth";
import { useHasMounted } from "@/lib/hooks/use-has-mounted";
import { NAV, NavIcon, EyeIcon, ViewAsField, accessLabel, type NavSection } from "@/components/layout/nav";

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

  const sections: NavSection[] = [
    ...(permissions?.canManageCoverage === true ? (["pu"] as const) : []),
    ...(permissions?.canBroadcast === true ? (["msg"] as const) : []),
  ];
  const access = accessLabel(permissions?.roles, permissions?.isAdmin);

  return (
    <nav
      aria-label="Main"
      className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-[#E5E5E5] bg-[#FAFAFA] text-[#0A0A0A] md:flex"
    >
      <div className="flex items-center gap-2.5 border-b border-[#EDEDED] px-3.5 py-4">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] bg-[#1E8A55] text-[13px] font-bold text-white"
        >
          PU
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5 text-[14px] font-bold">
            PU App
            <span className="rounded-[4px] border border-[#E5E5E5] bg-white px-1 text-[10px] font-medium text-[#737373]">v1</span>
          </span>
          <span className="text-[11px] text-[#737373]">NDC Campaign 2027</span>
        </span>
      </div>

      <div className="flex flex-col gap-1.5 border-b border-[#EDEDED] px-3 py-3.5">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#1E8A55]">
          <EyeIcon />
          View as
        </span>
        <ViewAsField value={session?.authenticated ? access : "Not signed in"} />
      </div>

      <div className="flex flex-col gap-4 px-3 py-3.5">
        {sections.map((key) => (
          <div key={key} className="flex flex-col gap-0.5">
            <span className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#8A8A8A]">
              {NAV[key].label}
            </span>
            {NAV[key].items.map((item) => {
              const active = item.isActive(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-8 items-center gap-2 rounded-[8px] px-2.5 text-[13px] font-medium no-underline transition-colors ${
                    active ? "bg-[#2F9E63] text-white hover:text-white" : "text-[#0A0A0A] hover:bg-[#F0F0F0] hover:text-[#0A0A0A]"
                  }`}
                >
                  <NavIcon path={item.icon} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-2.5 border-t border-[#EDEDED] px-3.5 py-3">
        {session?.authenticated && session.person ? (
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 flex-col">
              <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
                <span className="truncate">{session.person.fullName}</span>
                <span className="flex-none rounded-[4px] bg-[#E8F5EE] px-[5px] text-[10px] font-semibold text-[#1E8A55]">
                  {session.person.isAdmin ? "Admin" : "Signed in"}
                </span>
              </span>
              <span className="truncate text-[11px] text-[#737373]">Current access: {access}</span>
            </span>
            <button
              type="button"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              aria-label="Sign out"
              title="Sign out"
              className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[#525252] hover:bg-[#F0F0F0]"
            >
              <NavIcon size={16} path="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="inline-flex min-h-8 items-center justify-center rounded-[10px] bg-[#171717] px-3 text-[12px] font-medium text-[#FAFAFA] no-underline hover:text-[#FAFAFA]"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
