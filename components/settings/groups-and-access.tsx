"use client";

import { useId, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingBox, PageHeader, WF } from "@/components/ui/wf";
import { useCreateGroupType, useDeleteGroupType, useGroupAccess, useGroupTypeImpact } from "@/lib/hooks/use-settings";
import {
  CAN_MESSAGE_LABEL,
  NEW_TYPE_CAN_MESSAGE,
  SEES_COVERAGE_LABEL,
  SEES_COVERAGE_VALUES,
} from "@/lib/settings/group-access";
import type { CreateGroupTypePayload, GroupAccessRule } from "@/types/api";
import { cn } from "cn";

/** One row of the access table (wireframe 9 · Settings: groups and access). */
interface GroupRow {
  id: number;
  name: string;
  /** Built-in types (Admin, Party, Campaign, Support group) can't be deleted. */
  isSystem: boolean;
  canMessage: string;
  seesCoverageFor: string;
  logsIn: string;
  /** The short form shown at the top of the phone card. */
  logsInShort: string;
}

/** A group type from the API as a table row. Everyone signs in on the web app. */
function toRow(rule: GroupAccessRule): GroupRow {
  return {
    id: rule.id,
    name: rule.name,
    isSystem: rule.isSystem,
    canMessage: CAN_MESSAGE_LABEL[rule.canMessage],
    seesCoverageFor: SEES_COVERAGE_LABEL[rule.seesCoverage],
    logsIn: "Web app",
    logsInShort: "Web app",
  };
}

// The selects hold the words shown; these map them back to what the API takes.
const MESSAGE_OPTIONS = NEW_TYPE_CAN_MESSAGE.map((value) => ({ value, label: CAN_MESSAGE_LABEL[value] }));
// National: the whole country. Own area: only the areas set on each member (none set, nothing seen).
const COVERAGE_OPTIONS = SEES_COVERAGE_VALUES.map((value) => ({ value, label: SEES_COVERAGE_LABEL[value] }));

const COLUMNS: Array<{ key: "canMessage" | "seesCoverageFor" | "logsIn"; label: string }> = [
  { key: "canMessage", label: "Can message" },
  { key: "seesCoverageFor", label: "Sees coverage for" },
  { key: "logsIn", label: "Logs in" },
];

const INPUT_CLASS =
  "h-10 w-full min-w-0 rounded-[10px] border border-[#E5E5E5] bg-white px-3.5 text-[14px] text-[#0A0A0A] outline-none placeholder:text-[#A3A3A3] focus-visible:border-[#A3A3A3] focus-visible:ring-3 focus-visible:ring-[#E5E5E5]";

function GroupName({ row }: { row: GroupRow }) {
  return <span className="font-semibold">{row.name}</span>;
}

/** Desktop: the table from the wireframe. */
/** Delete, on groups an admin made only. */
function DeleteButton({ row, onDelete }: { row: GroupRow; onDelete: (row: GroupRow) => void }) {
  if (row.isSystem) return null;
  return (
    <button type="button" onClick={() => onDelete(row)} className={WF.btnRow} aria-label={`Delete ${row.name}`}>
      Delete
    </button>
  );
}

function GroupsTable({ rows, onDelete }: { rows: GroupRow[]; onDelete: (row: GroupRow) => void }) {
  return (
    <div className={cn(WF.card, "hidden overflow-x-auto md:block")}>
      <table className="w-full min-w-[760px] border-collapse text-[14px] text-[#0A0A0A]">
        <thead>
          <tr>
            <th scope="col" className={cn(WF.label, "px-5 py-3 text-left")}>
              Group
            </th>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" className={cn(WF.label, "px-5 py-3 text-left")}>
                {column.label}
              </th>
            ))}
            <th scope="col" className="px-5 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t border-[#F0F0F0]">
              <th scope="row" className="px-5 py-5 text-left align-middle font-normal">
                <GroupName row={row} />
              </th>
              {COLUMNS.map((column) => (
                <td
                  key={column.key}
                  className={cn("px-5 py-5 align-middle", column.key === "logsIn" && "text-[#737373]")}
                >
                  {row[column.key]}
                </td>
              ))}
              <td className="px-5 py-5 text-right align-middle">
                <DeleteButton row={row} onDelete={onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The rows of a phone card (wireframe 9, mobile). */
const CARD_ROWS: Array<{ key: "canMessage" | "seesCoverageFor"; label: string }> = [
  { key: "canMessage", label: "Can message" },
  { key: "seesCoverageFor", label: "Sees coverage" },
];

/** Phones: one card per group, as in the mobile wireframe. */
function GroupsCards({ rows, onDelete }: { rows: GroupRow[]; onDelete: (row: GroupRow) => void }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0 md:hidden">
      {rows.map((row) => (
        <li key={row.name} className={cn(WF.card, "flex flex-col gap-2 p-3.5")}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[16px] [&>span]:font-bold">
              <GroupName row={row} />
            </span>
            <span className="flex-none text-[12px] text-[#737373]">{row.logsInShort}</span>
          </div>
          <dl className="m-0 grid grid-cols-[110px_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 text-[13px]">
            {CARD_ROWS.map((item) => (
              <div key={item.key} className="contents">
                <dt className="text-[#737373]">{item.label}</dt>
                <dd className="m-0 break-words text-[#0A0A0A]">{row[item.key]}</dd>
              </div>
            ))}
          </dl>
          {row.isSystem ? null : (
            <div className="flex justify-end">
              <DeleteButton row={row} onDelete={onDelete} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

const DIALOG_BUTTON =
  "min-h-12 flex-1 rounded-[8px] px-5 text-[15px] font-semibold md:min-h-10 md:flex-none md:rounded-[10px] md:text-[14px]";

const plural = (count: number, one: string, many: string) => `${count.toLocaleString()} ${count === 1 ? one : many}`;

/**
 * "Are you sure?" before a group is deleted. It first loads what deleting would affect: a group
 * still in use can't be deleted, and the dialog lists who uses it instead of offering Delete.
 */
function DeleteGroupDialog({ row, open, onClose }: { row: GroupRow | null; open: boolean; onClose: () => void }) {
  const impact = useGroupTypeImpact(open && row ? row.id : null);
  const remove = useDeleteGroupType();
  const close = () => {
    if (remove.isPending) return;
    remove.reset();
    onClose();
  };
  const groups = impact.data?.groups ?? [];
  const members = groups.reduce((sum, group) => sum + group.members, 0);
  const agents = groups.reduce((sum, group) => sum + group.agents, 0);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent showCloseButton={false} className="gap-0 rounded-[14px] bg-white p-0 text-[#0A0A0A] sm:max-w-[480px]">
        <div className="flex flex-col gap-3 p-5">
          <DialogTitle className="text-[16px] leading-6 font-bold">Delete the {row?.name} group?</DialogTitle>
          {impact.isPending ? (
            <DialogDescription className="m-0 flex items-center gap-2 text-[14px] text-[#737373]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking what this would affect…
            </DialogDescription>
          ) : impact.isError ? (
            <DialogDescription role="alert" className="m-0 text-[14px] text-[#B42318]">
              {impact.error.message}
            </DialogDescription>
          ) : groups.length ? (
            <>
              <DialogDescription className="m-0 text-[14px] text-[#737373]">
                This can’t be deleted yet. {plural(groups.length, "group uses", "groups use")} it, with{" "}
                {plural(members, "member", "members")} and {plural(agents, "agent", "agents")}. Deleting it would leave them
                with no access rules, so members would lose access to coverage and messaging.
              </DialogDescription>
              <ul className="m-0 flex max-h-48 list-none flex-col gap-1.5 overflow-y-auto rounded-[10px] bg-[#FAFAFA] p-3 text-[13px]">
                {groups.map((group) => (
                  <li key={group.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 font-semibold">{group.name}</span>
                    <span className="flex-none text-[#737373]">
                      {plural(group.members, "member", "members")} · {plural(group.agents, "agent", "agents")}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="m-0 text-[13px] text-[#737373]">Move these groups to another type or remove them first.</p>
            </>
          ) : (
            <DialogDescription className="m-0 text-[14px] text-[#737373]">
              No groups use it, so no one loses access and no agents are affected. It will no longer be available for new
              groups. This can’t be undone.
            </DialogDescription>
          )}
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
            className={cn(WF.btnOutline, DIALOG_BUTTON, "md:font-medium")}
          >
            {impact.data && !impact.data.canDelete ? "Close" : "Cancel"}
          </button>
          {impact.data?.canDelete ? (
            <button
              type="button"
              onClick={() =>
                row &&
                remove.mutate(row.id, {
                  onSuccess: () => {
                    remove.reset();
                    onClose();
                  },
                })
              }
              disabled={remove.isPending}
              className={cn(
                "inline-flex items-center justify-center bg-[#B42318] text-white transition-colors hover:bg-[#912018] disabled:cursor-not-allowed disabled:opacity-60",
                DIALOG_BUTTON,
              )}
            >
              {remove.isPending ? "Deleting…" : "Delete group"}
            </button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The "New group" form from the wireframe. Saves the new group type, then closes. */
function NewGroupForm({ onDone }: { onDone: () => void }) {
  const id = useId();
  const create = useCreateGroupType();
  const [name, setName] = useState("");
  const [canMessage, setCanMessage] = useState<string>(CAN_MESSAGE_LABEL.agents_they_cover);
  const [coverage, setCoverage] = useState<string>(SEES_COVERAGE_LABEL.own_area);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (create.isPending) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name for the group");
      return;
    }
    const payload: CreateGroupTypePayload = {
      name: trimmed,
      canMessage: MESSAGE_OPTIONS.find((option) => option.label === canMessage)?.value ?? "agents_they_cover",
      seesCoverage: COVERAGE_OPTIONS.find((option) => option.label === coverage)?.value ?? "own_area",
    };
    setFormError(null);
    create.mutate(payload, {
      onSuccess: onDone,
      onError: (failure) => {
        if (failure.fields?.name) setError(failure.fields.name);
        else if (failure.status === 409) setError(failure.message);
        else setFormError(failure.message);
      },
    });
  };

  return (
    <form
      onSubmit={submit}
      aria-labelledby={`${id}-title`}
      className="flex w-full flex-col gap-3 rounded-[14px] border border-[#1F5FBF] bg-white p-4 md:gap-4 md:p-6"
    >
      <h2 id={`${id}-title`} className="m-0 text-[15px] font-bold text-[#0A0A0A] md:text-[16px]">
        New group
      </h2>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-name`} className="text-[13px] text-[#737373]">
          Name
        </label>
        <input
          id={`${id}-name`}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError(null);
          }}
          placeholder="Group name"
          maxLength={80}
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(INPUT_CLASS, "h-11 md:h-10")}
        />
        {error ? (
          <span id={`${id}-error`} role="alert" className="text-[12px] text-[#B42318]">
            {error}
          </span>
        ) : null}
      </div>

      {/* No "Can filter by": what a group sees is set by its coverage, and every filter inside it is allowed. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span id={`${id}-message`} className="text-[13px] text-[#737373]">
            Can message
          </span>
          <Select value={canMessage} onValueChange={(value) => typeof value === "string" && setCanMessage(value)}>
            <SelectTrigger aria-labelledby={`${id}-message`} className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESSAGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.label}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span id={`${id}-coverage`} className="text-[13px] text-[#737373]">
            Sees coverage for
          </span>
          <Select value={coverage} onValueChange={(value) => typeof value === "string" && setCoverage(value)}>
            <SelectTrigger aria-labelledby={`${id}-coverage`} className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COVERAGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.label}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
          {create.isPending ? "Creating…" : "Create group"}
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

/** Settings · Groups and access: the group types from the server, and a form to add one. */
export function GroupsAndAccess() {
  const { data: rules, isLoading, isError, error, refetch, isFetching } = useGroupAccess();
  const [formOpen, setFormOpen] = useState(false);
  // The row stays set while the dialog closes, so its name doesn't vanish mid-animation.
  const [deleting, setDeleting] = useState<GroupRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const askDelete = (row: GroupRow) => {
    setDeleting(row);
    setDeleteOpen(true);
  };
  const rows = (rules ?? []).map(toRow);

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 text-[#0A0A0A] md:gap-5">
      {/* Desktop: title, description and New group. Phones: the description only; the page name
          is already in the header row and New group sits at the bottom. */}
      <div className="hidden md:block">
        <PageHeader
          title="Groups and access"
          subtitle="Everyone sees and messages only what sits below them in the tree."
          actions={
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              disabled={formOpen}
              className={cn(WF.btnDark, "min-h-11 px-5 text-[14px]")}
            >
              New group
            </button>
          }
        />
      </div>
      <h1 className="sr-only md:hidden">Groups and access</h1>
      <p className="m-0 text-[13px] text-[#737373] md:hidden">
        Everyone sees and messages only what sits below them in the tree.
      </p>

      {isLoading ? (
        <LoadingBox>Loading groups…</LoadingBox>
      ) : isError ? (
        <div role="alert" className={cn(WF.card, "flex flex-col items-start gap-3 px-5 py-6")}>
          <p className="m-0 text-[14px] text-[#0A0A0A]">Could not load groups and access</p>
          <p className="m-0 text-[13px] text-[#737373]">{error.message}</p>
          <button type="button" onClick={() => void refetch()} disabled={isFetching} className={cn(WF.btnOutline, "min-h-10 px-4")}>
            {isFetching ? "Retrying…" : "Retry"}
          </button>
        </div>
      ) : (
        <>
          <GroupsTable rows={rows} onDelete={askDelete} />
          <GroupsCards rows={rows} onDelete={askDelete} />
        </>
      )}

      {!formOpen ? (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className={cn(WF.btnDark, "min-h-12 w-full rounded-[8px] text-[15px] font-semibold md:hidden")}
        >
          New group
        </button>
      ) : null}

      {formOpen ? (
        <NewGroupForm onDone={() => setFormOpen(false)} />
      ) : null}

      <DeleteGroupDialog row={deleting} open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </div>
  );
}
