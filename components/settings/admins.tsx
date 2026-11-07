"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CenterSpinner, EmptyBox, LoadingBox, PageHeader, WF } from "@/components/ui/wf";
import { SETTINGS_PAGE_SIZE, useAdmins, useCreateAdmin, useRemoveAdmin } from "@/lib/hooks/use-settings";
import { Pager, usePages } from "@/components/settings/pager";
import type { AdminListItem } from "@/types/api";
import { cn } from "cn";

const INPUT_CLASS =
  "h-11 w-full min-w-0 rounded-[10px] border border-[#E5E5E5] bg-white px-3.5 text-[14px] text-[#0A0A0A] outline-none placeholder:text-[#A3A3A3] focus-visible:border-[#A3A3A3] focus-visible:ring-3 focus-visible:ring-[#E5E5E5] md:h-10";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Same rule as the database check on phone numbers (E.164).
const PHONE_PATTERN = /^\+[1-9][0-9]{6,14}$/;
const SEARCH_DEBOUNCE_MS = 300;

const SUBTITLE = "Admins see everything, manage groups and access, and can message all agents.";

function AdminName({ row }: { row: AdminListItem }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5 font-semibold">
      {row.fullName}
      {row.isYou ? <span className={cn(WF.pill, "bg-[#F4F4F5] text-[#525252]")}>You</span> : null}
    </span>
  );
}

const notSet = (value: string | null) => value ?? "Not set";

/** Remove, except on your own row: you can't remove yourself. */
function RemoveButton({ row, onRemove }: { row: AdminListItem; onRemove: (row: AdminListItem) => void }) {
  if (row.isYou) return null;
  return (
    <button type="button" onClick={() => onRemove(row)} className={WF.btnRow} aria-label={`Remove ${row.fullName}`}>
      Remove
    </button>
  );
}

/** "Are you sure?" before an admin is removed. */
function RemoveAdminDialog({ admin, open, onClose }: { admin: AdminListItem | null; open: boolean; onClose: () => void }) {
  const remove = useRemoveAdmin();

  const close = () => {
    if (remove.isPending) return;
    remove.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && close()}>
      <DialogContent showCloseButton={false} className="gap-0 rounded-[14px] bg-white p-0 text-[#0A0A0A] sm:max-w-[440px]">
        <div className="flex flex-col gap-2 p-5">
          <DialogTitle className="text-[16px] leading-6 font-bold">Remove {admin?.fullName} as admin?</DialogTitle>
          <DialogDescription className="m-0 text-[14px] text-[#737373]">
            They will lose admin access and be signed out straight away. Their other groups, if any, stay as they are.
          </DialogDescription>
          {remove.isError ? (
            <p role="alert" className="m-0 text-[13px] text-[#B42318]">
              {remove.error.message}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2 border-t border-[#F0F0F0] p-4 md:justify-end">
          <button
            type="button"
            onClick={close}
            disabled={remove.isPending}
            className={cn(WF.btnOutline, "min-h-12 flex-1 rounded-[8px] px-5 text-[15px] font-semibold md:min-h-10 md:flex-none md:rounded-[10px] md:text-[14px] md:font-medium")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              admin &&
              remove.mutate(admin.personId, {
                onSuccess: () => {
                  remove.reset();
                  onClose();
                },
              })
            }
            disabled={remove.isPending}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-[8px] bg-[#B42318] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#912018] disabled:cursor-not-allowed disabled:opacity-60 md:min-h-10 md:flex-none md:rounded-[10px] md:text-[14px]"
          >
            {remove.isPending ? "Removing…" : "Remove admin"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Desktop: a table of admins. */
function AdminsTable({ rows, onRemove }: { rows: AdminListItem[]; onRemove: (row: AdminListItem) => void }) {
  return (
    <div className={cn(WF.card, "hidden overflow-x-auto md:block")}>
      <table className="w-full min-w-[640px] border-collapse text-[14px] text-[#0A0A0A]">
        <thead>
          <tr>
            {["Admin", "Email", "Phone", "Group"].map((label) => (
              <th key={label} scope="col" className={cn(WF.label, "px-5 py-3 text-left")}>
                {label}
              </th>
            ))}
            <th scope="col" className="px-5 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.personId} className="border-t border-[#F0F0F0]">
              <th scope="row" className="px-5 py-5 text-left align-middle font-normal">
                <AdminName row={row} />
              </th>
              <td className={cn("px-5 py-5 align-middle break-all", !row.email && "text-[#737373]")}>{notSet(row.email)}</td>
              <td className={cn("px-5 py-5 align-middle", WF.num, !row.phone && "text-[#737373]")}>{notSet(row.phone)}</td>
              <td className="px-5 py-5 align-middle text-[#737373]">{row.groups.join(", ")}</td>
              <td className="px-5 py-5 text-right align-middle">
                <RemoveButton row={row} onRemove={onRemove} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Phones: one card per admin. */
function AdminsCards({ rows, onRemove }: { rows: AdminListItem[]; onRemove: (row: AdminListItem) => void }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0 md:hidden">
      {rows.map((row) => (
        <li key={row.personId} className={cn(WF.card, "flex flex-col gap-2 p-3.5")}>
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 text-[16px] [&>span]:font-bold">
              <AdminName row={row} />
            </span>
            <RemoveButton row={row} onRemove={onRemove} />
          </div>
          <dl className="m-0 grid grid-cols-[70px_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 text-[13px]">
            <dt className="text-[#737373]">Group</dt>
            <dd className="m-0 text-[#0A0A0A]">{row.groups.join(", ")}</dd>
            <dt className="text-[#737373]">Email</dt>
            <dd className={cn("m-0 break-all", row.email ? "text-[#0A0A0A]" : "text-[#737373]")}>{notSet(row.email)}</dd>
            <dt className="text-[#737373]">Phone</dt>
            <dd className={cn("m-0", WF.num, row.phone ? "text-[#0A0A0A]" : "text-[#737373]")}>{notSet(row.phone)}</dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}

type FieldErrors = Partial<Record<"fullName" | "email" | "phone", string>>;

/** The "New admin" form. Saves the admin, then closes. */
function NewAdminForm({ onDone }: { onDone: () => void }) {
  const id = useId();
  const create = useCreateAdmin();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const clear = (field: keyof FieldErrors) => {
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (create.isPending) return;
    const name = fullName.trim().replace(/\s+/g, " ");
    const address = email.trim().toLowerCase();
    const number = phone.replace(/[\s-]/g, "");
    const next: FieldErrors = {};
    if (!name) next.fullName = "Enter the admin's full name";
    if (!address) next.email = "Enter the email they will sign in with";
    else if (!EMAIL_PATTERN.test(address)) next.email = "Enter a valid email address";
    if (number && !PHONE_PATTERN.test(number)) next.phone = "Use the international format, for example +2348031234567";
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    create.mutate(
      { fullName: name, email: address, ...(number ? { phone: number } : {}) },
      {
        onSuccess: onDone,
        onError: (failure) => {
          const fields = failure.fields ?? {};
          if (fields.fullName || fields.email || fields.phone) {
            setErrors({ fullName: fields.fullName, email: fields.email, phone: fields.phone });
          } else if (failure.status === 409 && failure.message !== "There is no admin group to add them to") {
            // "This admin already exists" or "This email already belongs to someone else".
            setErrors({ email: failure.message });
          } else {
            setFormError(failure.message);
          }
        },
      },
    );
  };

  const field = (
    key: keyof FieldErrors,
    label: string,
    input: { value: string; onChange: (value: string) => void; placeholder: string; type?: string; autoComplete?: string; inputMode?: "email" | "tel" },
    hint?: string,
  ) => {
    const errorId = `${id}-${key}-error`;
    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={`${id}-${key}`} className="text-[13px] text-[#737373]">
          {label}
        </label>
        <input
          id={`${id}-${key}`}
          type={input.type ?? "text"}
          value={input.value}
          onChange={(event) => {
            input.onChange(event.target.value);
            clear(key);
          }}
          placeholder={input.placeholder}
          autoComplete={input.autoComplete}
          inputMode={input.inputMode}
          maxLength={key === "fullName" ? 120 : 254}
          autoFocus={key === "fullName"}
          disabled={create.isPending}
          aria-invalid={errors[key] ? true : undefined}
          aria-describedby={errors[key] ? errorId : undefined}
          className={INPUT_CLASS}
        />
        {errors[key] ? (
          <span id={errorId} role="alert" className="text-[12px] text-[#B42318]">
            {errors[key]}
          </span>
        ) : hint ? (
          <span className="text-[12px] text-[#737373]">{hint}</span>
        ) : null}
      </div>
    );
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby={`${id}-title`}
      className="flex w-full flex-col gap-3 rounded-[14px] border border-[#1F5FBF] bg-white p-4 md:gap-4 md:p-6"
    >
      <h2 id={`${id}-title`} className="m-0 text-[15px] font-bold text-[#0A0A0A] md:text-[16px]">
        New admin
      </h2>

      {field("fullName", "Full name", { value: fullName, onChange: setFullName, placeholder: "Full name", autoComplete: "name" })}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {field(
          "email",
          "Email",
          { value: email, onChange: setEmail, placeholder: "name@example.com", type: "email", autoComplete: "email", inputMode: "email" },
          "They sign in with a code sent to this email.",
        )}
        {field(
          "phone",
          "Phone (optional)",
          { value: phone, onChange: setPhone, placeholder: "+2348031234567", type: "tel", autoComplete: "tel", inputMode: "tel" },
        )}
      </div>

      {formError ? (
        <p role="alert" className="m-0 text-[13px] text-[#B42318]">
          {formError}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={create.isPending}
          className={cn(WF.btnDark, "min-h-12 flex-1 rounded-[8px] px-5 text-[15px] font-semibold md:min-h-11 md:flex-none md:rounded-[10px] md:text-[14px]")}
        >
          {create.isPending ? "Adding…" : "Add admin"}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={create.isPending}
          className={cn(WF.btnOutline, "min-h-12 rounded-[8px] px-5 text-[15px] font-semibold md:min-h-11 md:rounded-[10px] md:text-[14px] md:font-medium")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Settings · Admins: everyone who is an admin, and a form to add one. */
export function Admins() {
  const id = useId();
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // The admin stays set while the dialog closes, so the name doesn't vanish mid-animation.
  const [removing, setRemoving] = useState<AdminListItem | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const askRemove = (row: AdminListItem) => {
    setRemoving(row);
    setConfirmOpen(true);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const admins = useAdmins(debouncedSearch);
  const paging = usePages(admins, debouncedSearch);
  const rows = paging.items;
  const refreshing = (admins.isFetching && !admins.isPending) || paging.loadingPage;

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 text-[#0A0A0A] md:gap-5">
      {/* Desktop: title, description and New admin. Phones: the description only; the page name
          is already in the header row and New admin sits at the bottom. */}
      <div className="hidden md:block">
        <PageHeader
          title="Admins"
          subtitle={SUBTITLE}
          actions={
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              disabled={formOpen}
              className={cn(WF.btnDark, "min-h-11 px-5 text-[14px]")}
            >
              New admin
            </button>
          }
        />
      </div>
      <h1 className="sr-only md:hidden">Admins</h1>
      <p className="m-0 text-[13px] text-[#737373] md:hidden">{SUBTITLE}</p>

      <div className="flex w-full max-w-[420px] flex-col gap-1">
        <label htmlFor={`${id}-search`} className="sr-only">
          Search admins
        </label>
        <input
          id={`${id}-search`}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or email"
          maxLength={100}
          className={INPUT_CLASS}
        />
      </div>

      {admins.isPending ? (
        <LoadingBox>Loading admins…</LoadingBox>
      ) : admins.isError ? (
        <div role="alert" className={cn(WF.card, "flex flex-col items-start gap-3 px-5 py-6")}>
          <p className="m-0 text-[14px] text-[#0A0A0A]">Could not load admins</p>
          <p className="m-0 text-[13px] text-[#737373]">{admins.error.message}</p>
          <button
            type="button"
            onClick={() => void admins.refetch()}
            disabled={admins.isFetching}
            className={cn(WF.btnOutline, "min-h-10 px-4")}
          >
            {admins.isFetching ? "Retrying…" : "Retry"}
          </button>
        </div>
      ) : rows.length ? (
        <div className="relative flex flex-col gap-3">
          <CenterSpinner show={refreshing} />
          <AdminsTable rows={rows} onRemove={askRemove} />
          <AdminsCards rows={rows} onRemove={askRemove} />
          <Pager
            page={paging.page}
            pageSize={SETTINGS_PAGE_SIZE}
            total={paging.total}
            loading={paging.loadingPage}
            noun={["admin", "admins"]}
            onPage={paging.setPage}
          />
        </div>
      ) : (
        <div className="relative">
          <CenterSpinner show={refreshing} />
          <EmptyBox>{debouncedSearch ? `No admins match “${debouncedSearch}”.` : "No admins yet."}</EmptyBox>
        </div>
      )}

      {!formOpen ? (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className={cn(WF.btnDark, "min-h-12 w-full rounded-[8px] text-[15px] font-semibold md:hidden")}
        >
          New admin
        </button>
      ) : null}

      {formOpen ? <NewAdminForm onDone={() => setFormOpen(false)} /> : null}

      <RemoveAdminDialog admin={removing} open={confirmOpen} onClose={() => setConfirmOpen(false)} />
    </div>
  );
}
