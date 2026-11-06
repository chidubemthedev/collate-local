"use client";

import { usePathname } from "next/navigation";
import { useSession, usePermissions } from "@/lib/hooks/use-auth";
import { useHasMounted } from "@/lib/hooks/use-has-mounted";
import { EyeIcon, accessLabel } from "@/components/layout/nav";

/** The desktop "Current access" bar above every page. Phones show access in the header instead. */
export function ViewAsBar() {
  const pathname = usePathname();
  const hasMounted = useHasMounted();
  const { data: sessionData } = useSession();
  const { data: permissionsData } = usePermissions();
  const session = hasMounted ? sessionData : undefined;
  const permissions = hasMounted ? permissionsData : undefined;

  if (pathname === "/login" || !session?.authenticated || !permissions) {
    return null;
  }

  const access = accessLabel(permissions.roles, permissions.isAdmin);

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
