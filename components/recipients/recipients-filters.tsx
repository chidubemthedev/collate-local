"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGeographyLgas, useGeographyStates, useGeographyWards } from "@/lib/hooks/use-geography";
import { FieldSpinner } from "@/components/ui/field-spinner";
import { TableToolbar, type ActiveTableFilter } from "@/components/ui/table-toolbar";
import { toTitleCase } from "@/components/candidates/candidates-filters";
import { WF, FILTER_GRID } from "@/components/ui/wf";

export type RecipientGroupFilter = "all" | "official" | "extra";
export type TelegramStatusFilter = "all" | "telegram" | "sms_only" | "not_matched";

const GROUP_OPTIONS: Array<{ value: RecipientGroupFilter; label: string }> = [
  { value: "all", label: "Everyone" },
  { value: "official", label: "Official agents" },
  { value: "extra", label: "Extra agents" },
];

const STATUS_OPTIONS: Array<{ value: TelegramStatusFilter; label: string }> = [
  { value: "all", label: "Any status" },
  { value: "telegram", label: "On Telegram" },
  { value: "sms_only", label: "SMS only" },
  { value: "not_matched", label: "Not matched" },
];

const LABEL_CLASS = `${WF.label} flex items-center gap-1.5 truncate`;
const TRIGGER_CLASS = "w-full";

interface RecipientsFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  group: RecipientGroupFilter;
  onGroupChange: (group: RecipientGroupFilter) => void;
  /** "all" or the id as a string. */
  stateId: string;
  onStateChange: (id: string) => void;
  lgaId: string;
  onLgaChange: (id: string) => void;
  wardId: string;
  onWardChange: (id: string) => void;
  status: TelegramStatusFilter;
  onStatusChange: (status: TelegramStatusFilter) => void;
  onReset: () => void;
}

export function RecipientsFilters({
  searchQuery,
  onSearchChange,
  group,
  onGroupChange,
  stateId,
  onStateChange,
  lgaId,
  onLgaChange,
  wardId,
  onWardChange,
  status,
  onStatusChange,
  onReset,
}: RecipientsFiltersProps) {
  const statesQuery = useGeographyStates();
  const states = statesQuery.data ?? [];
  const lgasQuery = useGeographyLgas(stateId === "all" ? null : stateId);
  const lgas = stateId === "all" ? [] : lgasQuery.data ?? [];
  const wardsQuery = useGeographyWards(lgaId === "all" ? null : lgaId);
  const wards = lgaId === "all" ? [] : wardsQuery.data ?? [];

  const statesBusy = statesQuery.isPending;
  const lgasBusy = stateId !== "all" && lgasQuery.isFetching;
  const wardsBusy = lgaId !== "all" && wardsQuery.isFetching;

  const foundState = states.find((item) => String(item.id) === stateId);
  const foundLga = lgas.find((item) => String(item.id) === lgaId);
  const foundWard = wards.find((item) => String(item.id) === wardId);

  const activeFilters: ActiveTableFilter[] = [
    ...(searchQuery.trim()
      ? [{ id: "search", label: `Search: ${searchQuery.trim()}`, onRemove: () => onSearchChange("") }]
      : []),
    ...(group !== "all"
      ? [{
          id: "group",
          label: `Group: ${GROUP_OPTIONS.find((option) => option.value === group)?.label ?? group}`,
          onRemove: () => onGroupChange("all"),
        }]
      : []),
    ...(stateId !== "all"
      ? [{
          id: "state",
          label: `State: ${foundState ? toTitleCase(foundState.name) : stateId}`,
          onRemove: () => {
            onStateChange("all");
            onLgaChange("all");
            onWardChange("all");
          },
        }]
      : []),
    ...(lgaId !== "all"
      ? [{
          id: "lga",
          label: `LGA: ${foundLga ? toTitleCase(foundLga.name) : lgaId}`,
          onRemove: () => {
            onLgaChange("all");
            onWardChange("all");
          },
        }]
      : []),
    ...(wardId !== "all"
      ? [{
          id: "ward",
          label: `Ward: ${foundWard ? toTitleCase(foundWard.name) : wardId}`,
          onRemove: () => onWardChange("all"),
        }]
      : []),
    ...(status !== "all"
      ? [{
          id: "status",
          label: `Telegram: ${STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status}`,
          onRemove: () => onStatusChange("all"),
        }]
      : []),
  ];

  return (
    <section aria-label="Filters" className={`${WF.card} p-3 sm:p-4`}>
      {/* Collapses behind a Filters button on phones, like the Coverage page. */}
      <TableToolbar
        activeFilters={activeFilters}
        onClear={onReset}
        summary={activeFilters.length ? "Filtered" : "None set"}
      >
      <div className={FILTER_GRID}>
        <div className="flex min-w-0 flex-col gap-1">
          <label className={LABEL_CLASS}>Search</label>
          <Input
            type="text"
            placeholder="Name or INEC code"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <label className={LABEL_CLASS}>Group</label>
          <Select value={group} onValueChange={(val) => val && onGroupChange(val as RecipientGroupFilter)}>
            <SelectTrigger className={TRIGGER_CLASS}>
              <SelectValue placeholder="Everyone">
                {(val) => GROUP_OPTIONS.find((option) => option.value === val)?.label ?? "Everyone"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {GROUP_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <label className={LABEL_CLASS}>
            State
            <FieldSpinner loading={statesBusy} />
          </label>
          <Select
            value={stateId}
            disabled={statesBusy || statesQuery.isError}
            onValueChange={(val) => {
              if (!val) return;
              onStateChange(val);
              onLgaChange("all");
              onWardChange("all");
            }}
          >
            <SelectTrigger className={TRIGGER_CLASS}>
              <SelectValue placeholder="All states">
                {(val) => {
                  if (statesBusy) return "Loading states…";
                  const found = states.find((item) => String(item.id) === val);
                  return found ? `${found.code} · ${toTitleCase(found.name)}` : "All states";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              {states.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.code} · {toTitleCase(item.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {statesQuery.isError && (
            <div role="alert" className="flex items-center gap-2 text-[12px] text-[#B42318]">
              <span>Could not load states.</span>
              <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => void statesQuery.refetch()}>
                Retry
              </Button>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <label className={LABEL_CLASS}>
            LGA
            <FieldSpinner loading={lgasBusy} />
          </label>
          <Select
            value={lgaId}
            disabled={stateId === "all" || lgasBusy || lgasQuery.isError}
            onValueChange={(val) => {
              if (!val) return;
              onLgaChange(val);
              onWardChange("all");
            }}
          >
            <SelectTrigger className={TRIGGER_CLASS}>
              <SelectValue placeholder="All LGAs">
                {(val) => {
                  if (lgasBusy) return "Loading LGAs…";
                  const found = lgas.find((item) => String(item.id) === val);
                  return found ? `${found.code} · ${toTitleCase(found.name)}` : "All LGAs";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All LGAs</SelectItem>
              {lgas.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.code} · {toTitleCase(item.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {stateId !== "all" && lgasQuery.isError && (
            <div role="alert" className="flex items-center gap-2 text-[12px] text-[#B42318]">
              <span>Could not load LGAs.</span>
              <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => void lgasQuery.refetch()}>
                Retry
              </Button>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <label className={LABEL_CLASS}>
            Ward
            <FieldSpinner loading={wardsBusy} />
          </label>
          <Select
            value={wardId}
            disabled={lgaId === "all" || wardsBusy || wardsQuery.isError}
            onValueChange={(val) => val && onWardChange(val)}
          >
            <SelectTrigger className={TRIGGER_CLASS}>
              <SelectValue placeholder="All wards">
                {(val) => {
                  if (wardsBusy) return "Loading wards…";
                  const found = wards.find((item) => String(item.id) === val);
                  return found ? toTitleCase(found.name) : "All wards";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All wards</SelectItem>
              {wards.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {toTitleCase(item.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {lgaId !== "all" && wardsQuery.isError && (
            <div role="alert" className="flex items-center gap-2 text-[12px] text-[#B42318]">
              <span>Could not load wards.</span>
              <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => void wardsQuery.refetch()}>
                Retry
              </Button>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <label className={LABEL_CLASS}>Telegram status</label>
          <Select value={status} onValueChange={(val) => val && onStatusChange(val as TelegramStatusFilter)}>
            <SelectTrigger className={TRIGGER_CLASS}>
              <SelectValue placeholder="Any status">
                {(val) => STATUS_OPTIONS.find((option) => option.value === val)?.label ?? "Any status"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

      </div>
      </TableToolbar>
    </section>
  );
}
