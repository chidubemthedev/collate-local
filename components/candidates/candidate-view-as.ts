"use client";

import { useMemo } from "react";
import { useSession, useSetViewAs, useViewAsOptions } from "@/lib/hooks/use-auth";

/**
 * "View as this candidate": previews the candidate's seat. Only seats within the person's own
 * access can be viewed, so it is off for the rest (with the reason in `title`).
 */
export function useCandidateViewAs(seatId: number) {
  const { data: session } = useSession();
  const { data: options, isLoading } = useViewAsOptions(session?.authenticated === true);
  const setViewAs = useSetViewAs();
  const allowed = useMemo(
    () => new Set(options?.groups.flatMap((group) => group.options.map((option) => option.value)) ?? []),
    [options],
  );

  const value = `seat:${seatId}`;
  const isCurrent = options?.current === value;
  const canView = allowed.has(value) && !isCurrent;
  const title = isLoading
    ? "Loading…"
    : isCurrent
    ? "You are already viewing as this candidate"
    : !allowed.has(value)
    ? "This seat is outside your access"
    : setViewAs.isPending
    ? "Switching view…"
    : undefined;

  return {
    canView: canView && !setViewAs.isPending,
    title,
    pending: setViewAs.isPending,
    start: () => {
      if (canView) setViewAs.mutate(value);
    },
  };
}
