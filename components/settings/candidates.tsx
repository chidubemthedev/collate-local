"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CenterSpinner, EmptyBox, Field, FILTER_GRID, LoadingBox, PageHeader, Pill, WF, type Tone } from "@/components/ui/wf";
import { FieldSpinner } from "@/components/ui/field-spinner";
import { Input } from "@/components/ui/input";
import { TableToolbar, type ActiveTableFilter } from "@/components/ui/table-toolbar";
import { SETTINGS_PAGE_SIZE, useCancelInvite, useCandidateInvites, useInviteCandidate } from "@/lib/hooks/use-settings";
import { Pager, usePages } from "@/components/settings/pager";
import type { CandidateInviteItem } from "@/types/api";
import { cn } from "cn";

const INPUT_CLASS =
  "h-11 w-full min-w-0 rounded-[10px] border border-[#E5E5E5] bg-white px-3.5 text-[14px] text-[#0A0A0A] outline-none placeholder:text-[#A3A3A3] focus-visible:border-[#A3A3A3] focus-visible:ring-3 focus-visible:ring-[#E5E5E5] md:h-10";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEARCH_DEBOUNCE_MS = 300;
const SUBTITLE = "Invite candidates and running mates by email. They get a link to complete registration, valid for 24 hours.";

const OFFICES = ["President", "Governor", "Senate", "House of Reps", "State Assembly"];
type Status = CandidateInviteItem["status"];
const STATUS: Record<Status, { label: string; tone: Tone }> = {
  not_invited: { label: "Not invited", tone: "muted" },
  invited: { label: "Invited", tone: "blue" },
  expired: { label: "Expired", tone: "amber" },
  registered: { label: "Registered", tone: "green" },
};

/** "Deputy Governor · Bauchi"; the President's seat is the whole country, so just the title. */
function seatText(row: CandidateInviteItem) {
  return row.title === "President" || row.title === "Vice President" ? row.title : `${row.title} · ${row.seat}`;
}

function formatWhen(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** The email and, for a pending invite, when it was sent or ran out. */
function EmailCell({ row }: { row: CandidateInviteItem }) {
  if (!row.email) return <span className="text-[#737373]">None yet</span>;
  const note =
    row.status === "invited"
      ? `Expires ${formatWhen(row.expiresAt)}`
      : row.status === "expired"
        ? `Expired ${formatWhen(row.expiresAt)}`
        : null;
  return (
    <span className="flex min-w-0 flex-col">
      <span className="break-all">{row.email}</span>
      {note ? <span className="text-[12px] text-[#737373]">{note}</span> : null}
    </span>
  );
}

type Ask = { kind: "invite" | "cancel"; row: CandidateInviteItem };

function Actions({ row, onAsk }: { row: CandidateInviteItem; onAsk: (ask: Ask) => void }) {
  if (row.status === "registered") return null;
  return (
    <span className="flex flex-wrap justify-end gap-1.5">
      <button type="button" onClick={() => onAsk({ kind: "invite", row })} className={WF.btnRow}>
        {row.status === "not_invited" ? "Invite" : "Resend"}
      </button>
      {row.status === "invited" ? (
        <button type="button" onClick={() => onAsk({ kind: "cancel", row })} className={WF.btnRow}>
          Cancel invite
        </button>
      ) : null}
    </span>
  );
}

/**
 * A ticket: a candidate with their running mate straight after them. The list comes ordered that
 * way. A running mate whose principal isn't in the list (filtered out) is a ticket of their own.
 */
type Ticket = { key: number; rows: CandidateInviteItem[] };

function toTickets(rows: CandidateInviteItem[]): Ticket[] {
  const tickets: Ticket[] = [];
  for (const row of rows) {
    const last = tickets[tickets.length - 1];
    if (row.principalCandidateId !== null && last?.key === row.principalCandidateId) last.rows.push(row);
    else tickets.push({ key: row.principalCandidateId ?? row.candidateId, rows: [row] });
  }
  return tickets;
}

/** The name; a running mate says so, and names their principal only when shown apart from them. */
function NameCell({ row, withPrincipal }: { row: CandidateInviteItem; withPrincipal: boolean }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="font-semibold">{row.fullName}</span>
      {row.isRunningMate ? (
        <span className="text-[12px] text-[#737373]">
          {withPrincipal ? "Running mate" : `Running mate of ${row.principalName}`}
        </span>
      ) : null}
    </span>
  );
}

/** Desktop: one block per ticket. No line between a candidate and their running mate. */
function CandidatesTable({ tickets, onAsk }: { tickets: Ticket[]; onAsk: (ask: Ask) => void }) {
  return (
    <div className={cn(WF.card, "hidden overflow-x-auto md:block")}>
      <table className="w-full min-w-[820px] border-collapse text-[14px] text-[#0A0A0A]">
        <thead>
          <tr>
            {["Candidate", "Seat", "Status", "Email"].map((label) => (
              <th key={label} scope="col" className={cn(WF.label, "px-5 py-3 text-left")}>
                {label}
              </th>
            ))}
            <th scope="col" className="px-5 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        {tickets.map((ticket) => (
          <tbody key={ticket.key} className="border-t border-[#F0F0F0]">
            {ticket.rows.map((row, index) => {
              const cell = cn("px-5 align-middle", index === 0 ? "pt-4" : "pt-1", index === ticket.rows.length - 1 ? "pb-4" : "pb-1");
              return (
                <tr key={row.candidateId}>
                  <th scope="row" className={cn(cell, "text-left font-normal")}>
                    <NameCell row={row} withPrincipal={index > 0} />
                  </th>
                  <td className={cell}>{seatText(row)}</td>
                  <td className={cell}>
                    <Pill tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Pill>
                  </td>
                  <td className={cell}>
                    <EmailCell row={row} />
                  </td>
                  <td className={cn(cell, "text-right")}>
                    <Actions row={row} onAsk={onAsk} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/** One person inside a phone card. */
function CardPerson({ row, withPrincipal, onAsk }: { row: CandidateInviteItem; withPrincipal: boolean; onAsk: (ask: Ask) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-[15px]">
          <NameCell row={row} withPrincipal={withPrincipal} />
        </span>
        <Pill tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Pill>
      </div>
      <dl className="m-0 grid grid-cols-[60px_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 text-[13px]">
        <dt className="text-[#737373]">Seat</dt>
        <dd className="m-0 text-[#0A0A0A]">{seatText(row)}</dd>
        <dt className="text-[#737373]">Email</dt>
        <dd className="m-0 text-[#0A0A0A]">
          <EmailCell row={row} />
        </dd>
      </dl>
      {row.status !== "registered" ? (
        <div className="flex justify-end">
          <Actions row={row} onAsk={onAsk} />
        </div>
      ) : null}
    </div>
  );
}

/** Phones: one card per ticket, the running mate in its lower half. */
function CandidatesCards({ tickets, onAsk }: { tickets: Ticket[]; onAsk: (ask: Ask) => void }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0 md:hidden">
      {tickets.map((ticket) => (
        <li key={ticket.key} className={cn(WF.card, "flex flex-col p-3.5")}>
          {ticket.rows.map((row, index) => (
            <div key={row.candidateId} className={cn(index > 0 && "mt-3 border-t border-[#F0F0F0] pt-3")}>
              <CardPerson row={row} withPrincipal={index > 0} onAsk={onAsk} />
            </div>
          ))}
        </li>
      ))}
    </ul>
  );
}

const DIALOG_CLASS = "gap-0 rounded-[14px] bg-white p-0 text-[#0A0A0A] sm:max-w-[460px]";
const DIALOG_BUTTON =
  "min-h-12 flex-1 rounded-[8px] px-5 text-[15px] font-semibold md:min-h-10 md:flex-none md:rounded-[10px] md:text-[14px]";

/** Invite or resend: asks for the email the link goes to. */
function InviteDialog({ row, open, onClose }: { row: CandidateInviteItem | null; open: boolean; onClose: () => void }) {
  const id = useId();
  const invite = useInviteCandidate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const resend = row?.status === "invited" || row?.status === "expired";

  const close = () => {
    if (invite.isPending) return;
    setEmail("");
    setError(null);
    setFormError(null);
    invite.reset();
    onClose();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!row || invite.isPending) return;
    const address = email.trim().toLowerCase();
    if (!address) return setError("Enter the candidate's email");
    if (!EMAIL_PATTERN.test(address)) return setError("Enter a valid email address");
    setError(null);
    setFormError(null);
    invite.mutate(
      { candidateId: row.candidateId, email: address },
      {
        onSuccess: () => {
          setEmail("");
          invite.reset();
          onClose();
        },
        onError: (failure) => {
          if (failure.fields?.email) setError(failure.fields.email);
          else if (failure.status === 409 && failure.message.toLowerCase().includes("email")) setError(failure.message);
          else setFormError(failure.message);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent showCloseButton={false} className={DIALOG_CLASS}>
        <form onSubmit={submit} noValidate>
          <div className="flex flex-col gap-3 p-5">
            <DialogTitle className="text-[16px] leading-6 font-bold">
              {resend ? "Send a new invite to" : "Invite"} {row?.fullName}
            </DialogTitle>
            <DialogDescription className="m-0 text-[14px] text-[#737373]">
              {row ? seatText(row) : null}. They’ll get an email with a link to complete registration. It works once and
              expires in 24 hours.{resend ? " The link sent before stops working." : ""}
            </DialogDescription>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-email`} className="text-[13px] text-[#737373]">
                Email
              </label>
              <input
                id={`${id}-email`}
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError(null);
                }}
                placeholder="name@example.com"
                maxLength={254}
                autoFocus
                disabled={invite.isPending}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                className={INPUT_CLASS}
              />
              {error ? (
                <span id={`${id}-error`} role="alert" className="text-[12px] text-[#B42318]">
                  {error}
                </span>
              ) : null}
            </div>
            {formError ? (
              <p role="alert" className="m-0 text-[13px] text-[#B42318]">
                {formError}
              </p>
            ) : null}
          </div>
          <div className="flex gap-2 border-t border-[#F0F0F0] p-4 md:justify-end">
            <button type="button" onClick={close} disabled={invite.isPending} className={cn(WF.btnOutline, DIALOG_BUTTON, "md:font-medium")}>
              Cancel
            </button>
            <button type="submit" disabled={invite.isPending} className={cn(WF.btnDark, DIALOG_BUTTON)}>
              {invite.isPending ? "Sending…" : resend ? "Send new invite" : "Send invite"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "Are you sure?" before an invite is cancelled. */
function CancelInviteDialog({ row, open, onClose }: { row: CandidateInviteItem | null; open: boolean; onClose: () => void }) {
  const cancel = useCancelInvite();
  const close = () => {
    if (cancel.isPending) return;
    cancel.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent showCloseButton={false} className={DIALOG_CLASS}>
        <div className="flex flex-col gap-2 p-5">
          <DialogTitle className="text-[16px] leading-6 font-bold">Cancel the invite for {row?.fullName}?</DialogTitle>
          <DialogDescription className="m-0 text-[14px] text-[#737373]">
            The link sent to {row?.email} will stop working. You can send a new invite later.
          </DialogDescription>
          {cancel.isError ? (
            <p role="alert" className="m-0 text-[13px] text-[#B42318]">
              {cancel.error.message}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2 border-t border-[#F0F0F0] p-4 md:justify-end">
          <button type="button" onClick={close} disabled={cancel.isPending} className={cn(WF.btnOutline, DIALOG_BUTTON, "md:font-medium")}>
            Keep invite
          </button>
          <button
            type="button"
            onClick={() =>
              row &&
              cancel.mutate(row.candidateId, {
                onSuccess: () => {
                  cancel.reset();
                  onClose();
                },
              })
            }
            disabled={cancel.isPending}
            className={cn(
              "inline-flex items-center justify-center bg-[#B42318] text-white transition-colors hover:bg-[#912018] disabled:cursor-not-allowed disabled:opacity-60",
              DIALOG_BUTTON,
            )}
          >
            {cancel.isPending ? "Cancelling…" : "Cancel invite"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ALL = "all";

/** Settings · Candidates: candidates and running mates, their invite status, and invites. */
export function CandidateInvites() {
  const id = useId();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [office, setOffice] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  // The row stays set while a dialog closes, so its text doesn't vanish mid-animation.
  const [ask, setAsk] = useState<Ask | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const filters = { q: debouncedSearch, office: office === ALL ? "" : office, status: status === ALL ? "" : status };
  const list = useCandidateInvites(filters);
  const paging = usePages(list, JSON.stringify(filters));
  const rows = paging.items;
  const tickets = toTickets(rows);
  const refreshing = (list.isFetching && !list.isPending) || paging.loadingPage;
  const filtered = Boolean(debouncedSearch) || office !== ALL || status !== ALL;

  // One chip per filter that's set, as on the other tables.
  const activeFilters: ActiveTableFilter[] = [
    ...(search.trim() ? [{ id: "search", label: `Search: ${search.trim()}`, onRemove: () => setSearch("") }] : []),
    ...(office !== ALL ? [{ id: "office", label: `Office: ${office}`, onRemove: () => setOffice(ALL) }] : []),
    ...(status !== ALL
      ? [{ id: "status", label: `Status: ${STATUS[status as Status]?.label ?? status}`, onRemove: () => setStatus(ALL) }]
      : []),
  ];
  const clearFilters = () => {
    setSearch("");
    setOffice(ALL);
    setStatus(ALL);
  };

  const onAsk = (next: Ask) => {
    setAsk(next);
    setDialogOpen(true);
  };
  const closeDialog = () => setDialogOpen(false);

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 text-[#0A0A0A] md:gap-5">
      <div className="hidden md:block">
        <PageHeader title="Candidates" subtitle={SUBTITLE} />
      </div>
      <h1 className="sr-only md:hidden">Candidates</h1>
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
                `${paging.total.toLocaleString()} candidate${paging.total === 1 ? "" : "s"} match${paging.total === 1 ? "es" : ""}`
              )}
            </span>
          }
        >
          <div className={FILTER_GRID}>
            <Field label="Search" htmlFor={`${id}-search`}>
              <Input
                id={`${id}-search`}
                type="search"
                autoComplete="off"
                placeholder="Name or seat"
                maxLength={100}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </Field>
            <Field label="Office">
              <Select value={office} onValueChange={(value) => typeof value === "string" && setOffice(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All offices">{(value) => (value === ALL ? "All offices" : String(value))}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All offices</SelectItem>
                  {OFFICES.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={status} onValueChange={(value) => typeof value === "string" && setStatus(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any status">
                    {(value) => (value === ALL ? "Any status" : STATUS[value as Status]?.label ?? "Any status")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Any status</SelectItem>
                  {(Object.keys(STATUS) as Status[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {STATUS[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </TableToolbar>
      </section>

      {list.isPending ? (
        <LoadingBox>Loading candidates…</LoadingBox>
      ) : list.isError ? (
        <div role="alert" className={cn(WF.card, "flex flex-col items-start gap-3 px-5 py-6")}>
          <p className="m-0 text-[14px] text-[#0A0A0A]">Could not load candidates</p>
          <p className="m-0 text-[13px] text-[#737373]">{list.error.message}</p>
          <button type="button" onClick={() => void list.refetch()} disabled={list.isFetching} className={cn(WF.btnOutline, "min-h-10 px-4")}>
            {list.isFetching ? "Retrying…" : "Retry"}
          </button>
        </div>
      ) : rows.length ? (
        <div className="relative flex flex-col gap-3">
          <CenterSpinner show={refreshing} />
          <CandidatesTable tickets={tickets} onAsk={onAsk} />
          <CandidatesCards tickets={tickets} onAsk={onAsk} />
          <Pager
            page={paging.page}
            pageSize={SETTINGS_PAGE_SIZE}
            total={paging.total}
            loading={paging.loadingPage}
            noun={["candidate", "candidates"]}
            onPage={paging.setPage}
          />
        </div>
      ) : (
        <div className="relative">
          <CenterSpinner show={refreshing} />
          <EmptyBox>{filtered ? "No candidates match these filters." : "No candidates yet."}</EmptyBox>
        </div>
      )}

      <InviteDialog row={ask?.kind === "invite" ? ask.row : null} open={dialogOpen && ask?.kind === "invite"} onClose={closeDialog} />
      <CancelInviteDialog row={ask?.kind === "cancel" ? ask.row : null} open={dialogOpen && ask?.kind === "cancel"} onClose={closeDialog} />
    </div>
  );
}
