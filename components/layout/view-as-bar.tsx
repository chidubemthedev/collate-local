"use client";

import { usePathname } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useSession, usePermissions, useSetViewAs } from "@/lib/hooks/use-auth";
import { useHasMounted } from "@/lib/hooks/use-has-mounted";
import { EyeIcon, accessLabel, isPublicPath } from "@/components/layout/nav";

/**
 * The "Current access" bar above every page (desktop). While "View as" is on it also shows on
 * phones, saying whose access is shown, that nothing can be changed, and how to exit.
 */
export function ViewAsBar() {
  const pathname = usePathname();
  const hasMounted = useHasMounted();
  const { data: sessionData } = useSession();
  const { data: permissionsData } = usePermissions();
  const session = hasMounted ? sessionData : undefined;
  const permissions = hasMounted ? permissionsData : undefined;
  const setViewAs = useSetViewAs();

  if (isPublicPath(pathname) || !session?.authenticated || !permissions) {
    return null;
  }

  const access = permissions.ownAccess ?? accessLabel(permissions.roles, permissions.isAdmin);

  if (permissions.viewAs) {
    return (
      <div
        role="status"
        // Stays at the top of the screen while scrolling (phones and larger screens), so the view and
        // Exit are always in reach.
        className="sticky top-0 z-30 flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-[#F5D9A8] bg-[#FFF8EB] px-4 py-2 text-[12px] text-[#7A4B00] md:px-8"
      >
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <EyeIcon size={14} />
          <span className="font-semibold">Viewing as {permissions.viewAs}</span>
          <span>· read-only</span>
          <span className="hidden text-[#9A6B1F] md:inline">· your access: {access}</span>
        </span>
        <button
          type="button"
          onClick={() => setViewAs.mutate(null)}
          disabled={setViewAs.isPending}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border border-[#E8C27A] bg-white px-3 text-[12px] font-semibold text-[#7A4B00] transition-colors hover:bg-[#FFF1D6] disabled:opacity-60"
        >
          {setViewAs.isPending ? <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : null}
          {setViewAs.isPending ? "Exiting…" : "Exit"}
        </button>
      </div>
    );
  }

  return (
    <div className="hidden min-h-11 flex-wrap items-center justify-between gap-3 border-b border-[#EDEDED] bg-white px-8 py-2 text-[12px] text-[#737373] md:flex">
      <span className="flex items-center gap-1.5">
        <EyeIcon size={14} />
        <span className="font-semibold text-[#0A0A0A]">Current access:</span> {access}
      </span>
      <span className="rounded-[8px] border border-[#E5E5E5] bg-[#FAFAFA] px-2 py-[3px]">View as · {access}</span>
    </div>
  );
}
