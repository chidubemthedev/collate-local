"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useSession, usePermissions } from "@/lib/hooks/use-auth";
import { useHasMounted } from "@/lib/hooks/use-has-mounted";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  const roles = permissions.roles.join(", ") || (permissions.isAdmin ? "Admin" : "Account");

  return (
    <div className="bg-muted/40 border-b border-border px-4 sm:px-6 lg:px-8 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Eye className="w-4 h-4 shrink-0" />
        <div>
          <span className="font-semibold text-foreground">Current access: </span>
          <span>{roles}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <Button
          variant="outline"
          size="sm"
          disabled
          title="Not available yet"
          className="h-6 text-[11px] px-2"
        >
          View as · Not available yet
        </Button>
      </div>
    </div>
  );
}
