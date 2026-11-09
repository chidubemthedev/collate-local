"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronRight, LoaderCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions, useSession, useSetViewAs, useViewAsOptions } from "@/lib/hooks/use-auth";
import { useHasMounted } from "@/lib/hooks/use-has-mounted";
import type { ViewAsOptionsData } from "@/types/api";

/** Full labels by value: seats listed under a heading ("Candidate · Governor") read "Candidate · Governor, Lagos". */
function fullLabels(options: ViewAsOptionsData | undefined): Map<string, string> {
  const labels = new Map<string, string>();
  for (const group of options?.groups ?? []) {
    for (const option of group.options) {
      labels.set(option.value, group.heading ? `${group.heading}, ${option.label}` : option.label);
    }
  }
  return labels;
}

const stateKey = (heading: string | null, state: string) => `${heading ?? ""}|${state}`;

/**
 * A row that opens or closes part of the list: an office (level 0) or a state inside it (level 1).
 * It keeps focus in the list (mouse down is ignored), so the dropdown stays open.
 */
function TreeToggle({
  label,
  count,
  open,
  onToggle,
  level = 0,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  level?: 0 | 1;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onToggle}
      className={`flex min-h-[34px] w-full cursor-pointer items-center justify-between gap-2 rounded-[6px] border-0 bg-transparent pr-2.5 text-left text-[13px] text-[#0A0A0A] hover:bg-[#F4F4F5] ${
        level === 0 ? "pl-2.5 font-semibold" : "pl-5 font-medium"
      }`}
    >
      <span className="truncate">
        {label} <span className="font-normal text-[#737373]">({count.toLocaleString()})</span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className={`size-4 flex-none text-[#737373] transition-transform duration-150 ${open ? "rotate-90" : ""}`}
      />
    </button>
  );
}

/**
 * The "View as" dropdown: the person's own access, then levels and seats below it, grouped by
 * office and, for Senate, House of Reps and State Assembly, by state. Picking one previews the
 * app with that access (read-only) until they exit.
 */
export function ViewAsField() {
  const hasMounted = useHasMounted();
  const { data: sessionData } = useSession();
  const { data: permissionsData } = usePermissions();
  // Same as the sidebar: nothing from the cache before hydration, so server and client match.
  const session = hasMounted ? sessionData : undefined;
  const permissions = hasMounted ? permissionsData : undefined;
  const signedIn = session?.authenticated === true;
  const { data: options, isLoading, isError } = useViewAsOptions(signedIn);
  const setViewAs = useSetViewAs();
  const labels = useMemo(() => fullLabels(options), [options]);
  // One office and one state open at a time, so the list stays short (Assembly has 774 seats).
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [openState, setOpenState] = useState<string | null>(null);
  const groupOf = (value: string | undefined) =>
    options?.groups.find((group) => group.heading && group.options.some((option) => option.value === value))
      ?.heading ?? null;
  const stateOf = (value: string | undefined) => {
    for (const group of options?.groups ?? []) {
      const state = group.states?.find((item) => item.options.some((option) => option.value === value));
      if (state) return stateKey(group.heading, state.name);
    }
    return null;
  };

  const optionCount = options?.groups.reduce((sum, group) => sum + group.options.length, 0) ?? 0;
  const nothingBelow = options !== undefined && optionCount <= 1;
  const disabled = !signedIn || isLoading || isError || nothingBelow || setViewAs.isPending;
  const title = !signedIn
    ? undefined
    : isError
    ? "Could not load the views you can switch to"
    : nothingBelow
    ? "There is no narrower access to view as"
    : undefined;

  const shownLabel = (value: string | null) => {
    if (!session) return "…";
    if (!signedIn) return "Not signed in";
    if (setViewAs.isPending) return "Switching view…";
    if (permissions?.viewAs) return permissions.viewAs;
    return (value && labels.get(value)) ?? permissions?.ownAccess ?? "Loading…";
  };

  return (
    <div className="flex flex-col gap-1">
      <Select
        value={options?.current ?? null}
        onValueChange={(value) => {
          if (typeof value !== "string" || value === options?.current) return;
          // Picking your own access is the same as exiting the view.
          setViewAs.mutate(value === options?.self.value ? null : value);
        }}
        disabled={disabled}
        onOpenChange={(open) => {
          // Open on the office (and state) of the view that is on, if any.
          if (open) {
            setOpenGroup(groupOf(options?.current));
            setOpenState(stateOf(options?.current));
          }
        }}
      >
        <SelectTrigger aria-label="View as" title={title} className="w-full min-w-0">
          {setViewAs.isPending || (signedIn && isLoading) ? (
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin text-[#737373]" />
          ) : null}
          <SelectValue className="min-w-0 truncate">{(value) => shownLabel(typeof value === "string" ? value : null)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options?.groups.map((group, index) => (
            <Fragment key={group.heading ?? `single-${index}`}>
              {index > 0 ? <SelectSeparator /> : null}
              <SelectGroup>
                {group.heading ? (
                  <TreeToggle
                    label={group.heading}
                    count={group.options.length}
                    open={openGroup === group.heading}
                    onToggle={() => {
                      setOpenGroup((current) => (current === group.heading ? null : group.heading));
                      setOpenState(null);
                    }}
                  />
                ) : null}
                {!group.heading || openGroup === group.heading
                  ? group.states
                    ? // Senate, House of Reps, State Assembly: office -> state -> seats.
                      group.states.map((state) => {
                        const key = stateKey(group.heading, state.name);
                        return (
                          <Fragment key={key}>
                            <TreeToggle
                              label={state.name}
                              count={state.options.length}
                              open={openState === key}
                              onToggle={() => setOpenState((current) => (current === key ? null : key))}
                              level={1}
                            />
                            {openState === key
                              ? state.options.map((option) => (
                                  <SelectItem key={option.value} value={option.value} className="pl-9">
                                    {option.label}
                                  </SelectItem>
                                ))
                              : null}
                          </Fragment>
                        );
                      })
                    : // Single entries, and Governor (whose seats are the states).
                      group.options.map((option) => (
                        <SelectItem key={option.value} value={option.value} className={group.heading ? "pl-5" : undefined}>
                          {option.label}
                        </SelectItem>
                      ))
                  : null}
              </SelectGroup>
            </Fragment>
          ))}
        </SelectContent>
      </Select>
      {setViewAs.isError ? (
        <span role="alert" className="text-[11px] text-[#B42318]">
          {setViewAs.error.message}
        </span>
      ) : null}
    </div>
  );
}
