"use client";

import { useEffect, useId, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CenterSpinner, EmptyBox, Field, FILTER_GRID, LoadingBox, PageHeader, Pill, WF } from "@/components/ui/wf";
import { FieldSpinner } from "@/components/ui/field-spinner";
import { Input } from "@/components/ui/input";
import { TableToolbar, type ActiveTableFilter } from "@/components/ui/table-toolbar";
import { Pager, usePages } from "@/components/settings/pager";
import { SETTINGS_PAGE_SIZE, useAuditLog, type AuditLogFilters } from "@/lib/hooks/use-settings";
import type { AuditLogItem } from "@/types/api";
import { cn } from "cn";

const SEARCH_DEBOUNCE_MS = 300;
const SUBTITLE = "Who did what, newest first. Entries can't be changed or deleted.";

const KIND_LABEL: Record<AuditLogFilters["kind"], string> = {
  changes: "Changes",
  views: "Views",
  all: "Everything",
};

/** "7 Nov 2026, 10:42" in Nigerian time. */
function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "7 Nov 2026" for a YYYY-MM-DD day. */
function formatDay(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

const TARGET_TYPE: Record<string, string> = {
  person: "Person",
  candidate: "Candidate",
  group_type: "Group",
  ward: "Ward",
  agent_assignment: "Agent assignment",
  broadcast: "Broadcast",
};

/** What the action was done to: a name where one is known, otherwise its kind. */
function targetText(target: AuditLogItem["target"]): { main: string; sub: string | null } | null {
  if (!target) return null;
  const kind = TARGET_TYPE[target.type] ?? target.type;
  if (target.name) return { main: target.name, sub: kind };
  // A list view logs every candidate shown, comma-separated.
  if (target.type === "candidate" && target.id?.includes(",")) {
    return { main: `${target.id.split(",").length} candidates`, sub: null };
  }
  if (target.type === "person" || target.type === "candidate" || target.type === "group_type") {
    return { main: kind, sub: "No longer exists" };
  }
  return { main: kind, sub: null };
}

function Who({ row }: { row: AuditLogItem }) {
  if (!row.actor) return <span className="text-[#737373]">System</span>;
  return row.actor.name ? <span className="font-semibold">{row.actor.name}</span> : <span className="text-[#737373]">Deleted person</span>;
}

function What({ row }: { row: AuditLogItem }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {row.actionLabel}
      {row.isView ? <Pill tone="muted">View</Pill> : null}
    </span>
  );
}

function Target({ row }: { row: AuditLogItem }) {
  const target = targetText(row.target);
  if (!target) return <span className="text-[#737373]">None</span>;
  return (
    <span className="flex min-w-0 flex-col">
      <span className="break-words">{target.main}</span>
      {target.sub ? <span className="text-[12px] text-[#737373]">{target.sub}</span> : null}
    </span>
  );
}

/** Desktop: one row per entry. */
function AuditTable({ rows }: { rows: AuditLogItem[] }) {
  return (
    <div className={cn(WF.card, "hidden overflow-x-auto md:block")}>
      <table className="w-full min-w-[860px] border-collapse text-[14px] text-[#0A0A0A]">
        <thead>
          <tr>
            {["When", "Who", "What", "To", "IP address"].map((label) => (
              <th key={label} scope="col" className={cn(WF.label, "px-5 py-3 text-left")}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-[#F0F0F0]">
              <td className={cn("px-5 py-4 align-middle whitespace-nowrap text-[#737373]", WF.num)}>
                <time dateTime={row.at}>{formatWhen(row.at)}</time>
              </td>
              <td className="px-5 py-4 align-middle">
                <Who row={row} />
              </td>
              <td className="px-5 py-4 align-middle">
                <What row={row} />
              </td>
              <td className="px-5 py-4 align-middle">
                <Target row={row} />
              </td>
              <td className={cn("px-5 py-4 align-middle text-[#737373]", WF.num)}>{row.ipAddress ?? "Unknown"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Phones: one card per entry. */
function AuditCards({ rows }: { rows: AuditLogItem[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0 md:hidden">
      {rows.map((row) => (
        <li key={row.id} className={cn(WF.card, "flex flex-col gap-2 p-3.5")}>
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 text-[15px]">
              <What row={row} />
            </span>
            <time dateTime={row.at} className={cn("flex-none text-[12px] text-[#737373]", WF.num)}>
              {formatWhen(row.at)}
            </time>
          </div>
          <dl className="m-0 grid grid-cols-[50px_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 text-[13px]">
            <dt className="text-[#737373]">Who</dt>
            <dd className="m-0">
              <Who row={row} />
            </dd>
            <dt className="text-[#737373]">To</dt>
            <dd className="m-0">
              <Target row={row} />
            </dd>
            <dt className="text-[#737373]">IP</dt>
            <dd className={cn("m-0 text-[#737373]", WF.num)}>{row.ipAddress ?? "Unknown"}</dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}

/** Settings · Audit log: who did what, newest first. Admins only. */
export function AuditLog() {
  const id = useId();
  const [kind, setKind] = useState<AuditLogFilters["kind"]>("changes");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // A To date before From would be refused, so only send dates that make a range.
  const datesOk = !from || !to || from <= to;
  const filters: AuditLogFilters = { kind, q: debouncedSearch, from: datesOk ? from : "", to: datesOk ? to : "" };
  const log = useAuditLog(filters);
  const paging = usePages(log, JSON.stringify(filters));
  const rows = paging.items;
  const refreshing = (log.isFetching && !log.isPending) || paging.loadingPage;
  const filtered = kind !== "changes" || Boolean(debouncedSearch) || Boolean(from) || Boolean(to);

  // One chip per filter that's set ("Changes" is the default, so it gets none).
  const activeFilters: ActiveTableFilter[] = [
    ...(kind !== "changes" ? [{ id: "kind", label: `Show: ${KIND_LABEL[kind]}`, onRemove: () => setKind("changes") }] : []),
    ...(search.trim() ? [{ id: "who", label: `Who: ${search.trim()}`, onRemove: () => setSearch("") }] : []),
    ...(from ? [{ id: "from", label: `From: ${formatDay(from)}`, onRemove: () => setFrom("") }] : []),
    ...(to ? [{ id: "to", label: `To: ${formatDay(to)}`, onRemove: () => setTo("") }] : []),
  ];
  const clearFilters = () => {
    setKind("changes");
    setSearch("");
    setFrom("");
    setTo("");
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 text-[#0A0A0A] md:gap-5">
      <div className="hidden md:block">
        <PageHeader title="Audit log" subtitle={SUBTITLE} />
      </div>
      <h1 className="sr-only md:hidden">Audit log</h1>
      <p className="m-0 text-[13px] text-[#737373] md:hidden">{SUBTITLE}</p>

      <section aria-label="Filters" className={cn(WF.card, "p-3 sm:px-4 sm:py-3.5")}>
        {/* Collapses behind a Filters bar on phones, as on the other tables. */}
        <TableToolbar
          activeFilters={activeFilters}
          onClear={clearFilters}
          summary={activeFilters.length ? "Filtered" : "None set"}
          meta={
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[#737373]" aria-live="polite">
              {refreshing ? (
                <>
                  <FieldSpinner loading />
                  Updating results…
                </>
              ) : (
                `${paging.total.toLocaleString()} ${paging.total === 1 ? "entry matches" : "entries match"}`
              )}
            </span>
          }
        >
          <div className={FILTER_GRID}>
            <Field label="Show">
              <Select value={kind} onValueChange={(value) => value && setKind(value as AuditLogFilters["kind"])}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Changes">{(value) => KIND_LABEL[value as AuditLogFilters["kind"]] ?? "Changes"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_LABEL) as AuditLogFilters["kind"][]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {KIND_LABEL[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Who" htmlFor={`${id}-search`}>
              <Input
                id={`${id}-search`}
                type="search"
                autoComplete="off"
                placeholder="Name or email"
                maxLength={100}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </Field>
            <Field label="From" htmlFor={`${id}-from`}>
              <Input id={`${id}-from`} type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
            </Field>
            <Field label="To" htmlFor={`${id}-to`}>
              <Input id={`${id}-to`} type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
            </Field>
          </div>
          {!datesOk ? (
            <p role="alert" className="m-0 mt-2 text-[12px] text-[#B42318]">
              From is after To, so the dates are ignored.
            </p>
          ) : null}
        </TableToolbar>
      </section>

      {log.isPending ? (
        <LoadingBox>Loading the audit log…</LoadingBox>
      ) : log.isError ? (
        <div role="alert" className={cn(WF.card, "flex flex-col items-start gap-3 px-5 py-6")}>
          <p className="m-0 text-[14px] text-[#0A0A0A]">Could not load the audit log</p>
          <p className="m-0 text-[13px] text-[#737373]">{log.error.message}</p>
          <button type="button" onClick={() => void log.refetch()} disabled={log.isFetching} className={cn(WF.btnOutline, "min-h-10 px-4")}>
            {log.isFetching ? "Retrying…" : "Retry"}
          </button>
        </div>
      ) : rows.length ? (
        <div className="relative flex flex-col gap-3">
          <CenterSpinner show={refreshing} />
          <AuditTable rows={rows} />
          <AuditCards rows={rows} />
          <Pager
            page={paging.page}
            pageSize={SETTINGS_PAGE_SIZE}
            total={paging.total}
            loading={paging.loadingPage}
            noun={["entry", "entries"]}
            onPage={paging.setPage}
          />
        </div>
      ) : (
        <div className="relative">
          <CenterSpinner show={refreshing} />
          <EmptyBox>{filtered ? "No entries match these filters." : "Nothing has been recorded yet."}</EmptyBox>
        </div>
      )}
    </div>
  );
}
