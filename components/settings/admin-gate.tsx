"use client";

import type { ReactNode } from "react";
import { usePermissions } from "@/lib/hooks/use-auth";
import { useHasMounted } from "@/lib/hooks/use-has-mounted";
import { LoadingBox, PageHeader, WF } from "@/components/ui/wf";

/** Shows a Settings page to admins only; everyone else gets a short note. */
export function AdminGate({ title, loading, children }: { title: string; loading: string; children: ReactNode }) {
  const hasMounted = useHasMounted();
  const { data: permissionsData, isLoading } = usePermissions();
  const permissions = hasMounted ? permissionsData : undefined;

  if (!hasMounted || isLoading) {
    return <LoadingBox>{loading}</LoadingBox>;
  }

  if (!permissions?.isAdmin) {
    const what = title.toLowerCase();
    return (
      <div className="flex w-full min-w-0 flex-col gap-4">
        <PageHeader title={title} />
        <p role="status" className={`${WF.card} m-0 px-5 py-6 text-[14px] text-[#737373]`}>
          {permissions?.viewAs
            ? `Only admins can manage ${what}. You are viewing as ${permissions.viewAs}.`
            : `Only admins can manage ${what}.`}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
