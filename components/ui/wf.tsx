import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "cn";

/**
 * Shared styles from the PU App v1 wireframes, so every page uses the same sizes and colours.
 * Text #0A0A0A, muted #737373, border #E5E5E5, row rule #F0F0F0, green #1E8A55, purple #6D28D9.
 */
export const WF = {
  card: "rounded-[14px] border border-[#E5E5E5] bg-white",
  label: "text-[11px] font-semibold uppercase tracking-[0.04em] text-[#737373]",
  btnOutline:
    "inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-[#E5E5E5] bg-white px-3 text-[12px] font-medium text-[#0A0A0A] no-underline transition-colors hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-60",
  btnDark:
    "inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-[10px] bg-[#171717] px-3 text-[12px] font-medium text-[#FAFAFA] no-underline transition-colors hover:bg-[#262626] hover:text-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-60",
  btnRow:
    "inline-flex min-h-7 shrink-0 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-white px-2.5 text-[12px] font-medium text-[#0A0A0A] transition-colors hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-60",
  table: "w-full border-collapse text-[13px] text-[#0A0A0A]",
  th: "px-2 py-2.5 text-left text-[12px] font-semibold whitespace-nowrap text-[#0A0A0A]",
  td: "px-2 py-2.5",
  tr: "border-t border-[#F0F0F0]",
  pill: "inline-flex shrink-0 self-start items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4",
  sectionTitle: "text-[15px] font-bold text-[#0A0A0A]",
  scopeChip: "rounded-full border border-[#E5E5E5] px-2 py-px text-[12px] text-[#0A0A0A]",
  greyChip: "rounded-full bg-[#F4F4F5] px-2 py-px text-[12px] text-[#737373]",
  note: "m-0 text-[12px] text-[#737373]",
  num: "tabular-nums",
} as const;

export const TONE = {
  green: "bg-[#E8F5EE] text-[#1E8A55]",
  amber: "bg-[#FEF3C7] text-[#92400E]",
  red: "bg-[#FDECEC] text-[#B42318]",
  grey: "bg-[#F4F4F5] text-[#525252]",
  muted: "bg-[#F4F4F5] text-[#737373]",
  purple: "bg-[#F3E8FF] text-[#6D28D9]",
  blue: "bg-[#DBEAFE] text-[#1E40AF]",
  sky: "bg-[#E0F2FE] text-[#075985]",
  teal: "bg-[#CCFBF1] text-[#115E59]",
  pink: "bg-[#FCE7F3] text-[#9D174D]",
  orange: "bg-[#FDF0E3] text-[#8A3F08]",
} as const;

export type Tone = keyof typeof TONE;

/** Office colours used for candidate badges on every page. */
export function officeTone(office: string): Tone {
  const name = office.toLowerCase();
  if (name.includes("vice") || name.includes("deputy")) return "muted";
  if (name.includes("president")) return "purple";
  if (name.includes("governor")) return "amber";
  if (name.includes("senat")) return "blue";
  if (name.includes("rep")) return "teal";
  if (name.includes("assembly")) return "pink";
  return "grey";
}

export function Pill({ tone = "grey", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return <span className={cn(WF.pill, TONE[tone], className)}>{children}</span>;
}

/** The small green "INEC" source tag. */
export function InecTag() {
  return (
    <span className="rounded-[4px] bg-[#E8F5EE] px-[5px] py-px text-[10px] font-bold text-[#1E8A55]">INEC</span>
  );
}

export function Bar({ pct, fill = "#22A06B", track = "#EEF7F1", className }: { pct: number; fill?: string; track?: string; className?: string }) {
  const width = Math.min(100, Math.max(0, pct));
  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
      className={cn("block h-1 overflow-hidden rounded-[2px]", className)}
      style={{ background: track }}
    >
      <span className="block h-1 transition-[width] duration-500" style={{ width: `${width}%`, background: fill }} />
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="m-0 text-[20px] leading-7 font-bold text-[#0A0A0A] sm:text-[24px] sm:leading-8">{title}</h1>
        {subtitle ? <p className="m-0 text-[14px] text-[#737373]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** A labelled filter field: the uppercase label above a select or input. */
export function Field({ label, htmlFor, extra, children }: { label: ReactNode; htmlFor?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={htmlFor} className={cn(WF.label, "flex items-center gap-1.5")}>
        {label}
        {extra}
      </label>
      {children}
    </div>
  );
}

/** Grid for filter fields: auto-fit columns on desktop, one column on phones. */
export const FILTER_GRID = "grid grid-cols-1 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] sm:items-end";

/** Centred spinner shown over a table or card while it refreshes. */
export function CenterSpinner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/50">
      <Loader2 className="h-5 w-5 animate-spin text-[#737373]" aria-label="Loading" />
    </div>
  );
}

export function LoadingBox({ children }: { children: ReactNode }) {
  return (
    <div role="status" className={cn(WF.card, "flex items-center gap-2 px-6 py-10 text-[15px] text-[#737373]")}>
      <Loader2 className="h-4 w-4 animate-spin" />
      {children}
    </div>
  );
}

/** A summary tile: label, value with optional suffix on one baseline, then a note. */
export function StatTile({
  label,
  value,
  suffix,
  note,
  color = "#0A0A0A",
  inec = false,
}: {
  label: ReactNode;
  value: ReactNode;
  suffix?: ReactNode;
  note?: ReactNode;
  color?: string;
  inec?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-[14px] border border-[#E5E5E5] bg-white p-3.5">
      <span className="block h-[18px] truncate text-[12px] font-medium text-[#525252]">{label}</span>
      <span className="mt-2.5 flex h-8 items-baseline gap-1.5">
        <span className="text-[24px] leading-8 font-bold tabular-nums" style={{ color }}>
          {value}
        </span>
        {suffix ? <span className="text-[12px] whitespace-nowrap tabular-nums text-[#737373]">{suffix}</span> : null}
      </span>
      {note ? (
        <span className="mt-2 text-[11px] leading-[15px] text-[#737373]">
          {inec ? (
            <>
              <InecTag />{" "}
            </>
          ) : null}
          {note}
        </span>
      ) : null}
    </div>
  );
}

/** Pill-style tabs with counts (office tabs, record tabs, broadcast tabs). */
export function CountTabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  dim = false,
}: {
  label: string;
  tabs: Array<{ id: T; label: string; count?: number | string; disabled?: boolean }>;
  value: T;
  onChange: (id: T) => void;
  dim?: boolean;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex max-w-full gap-1 self-start overflow-x-auto rounded-[10px] bg-[#F4F4F5] p-[3px]">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={`inline-flex min-h-[30px] flex-none items-center gap-1.5 rounded-[8px] border-0 px-3 text-[13px] disabled:opacity-50 ${
              active
                ? "bg-white font-semibold text-[#0A0A0A] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                : "bg-transparent font-medium text-[#525252]"
            }`}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span
                className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums transition-opacity ${
                  active ? "bg-[#171717] text-[#FAFAFA]" : "bg-[#E5E5E5] text-[#525252]"
                } ${dim ? "opacity-50" : ""}`}
              >
                {typeof tab.count === "number" ? tab.count.toLocaleString() : tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyBox({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 rounded-[10px] border border-dashed border-[#E5E5E5] p-5 text-[14px] text-[#737373]">{children}</p>
  );
}
