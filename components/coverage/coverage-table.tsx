"use client";

import React, { useState } from "react";
import { StateData, LGAData, WardData, PollingUnitData } from "@/lib/types";
import { PUDetailDrawer } from "./pu-detail-drawer";
import { WF, Bar } from "@/components/ui/wf";

// INEC names come in upper case (e.g. "AKWA IBOM"); show them as "Akwa Ibom", keeping FCT as is.
function toTitleCase(name: string) {
  return name
    .toLowerCase()
    .replace(/(^|[\s\-'(/])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\bFct\b/g, "FCT");
}

const PAGE_SIZE = 25;

interface CoverageTableProps {
  level: "national" | "state" | "lga" | "ward";
  states: StateData[];
  lgas: LGAData[];
  wards: WardData[];
  pollingUnits: PollingUnitData[];
  /** Name of the ward being shown, for the polling-unit table title. */
  areaName?: string;
  onOpenState: (code: string) => void;
  onOpenLga: (code: string) => void;
  onOpenWard: (code: string) => void;
}

interface AggRow {
  code: string;
  name: string;
  totalPUs: number;
  gpsPUs: number;
  coveredPUs: number;
  officialAgentPct: number;
  extraAgentsCount: number;
  open: () => void;
}

const HEADING = { national: "State", state: "LGA", lga: "Ward", ward: "Polling unit" } as const;
const LEVEL_TAG = { national: "National", state: "State", lga: "LGA", ward: "Ward" } as const;
const PLURAL = { national: "states", state: "LGAs", lga: "wards", ward: "polling units" } as const;

const pctOf = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);
const fmt = (n: number) => n.toLocaleString();

export function CoverageTable({
  level,
  states,
  lgas,
  wards,
  pollingUnits,
  areaName,
  onOpenState,
  onOpenLga,
  onOpenWard,
}: CoverageTableProps) {
  const [selectedPU, setSelectedPU] = useState<PollingUnitData | null>(null);
  const [isPUModalOpen, setIsPUModalOpen] = useState(false);

  // Back to page 1 when the level or data changes. The page is stored with the data it belongs to,
  // so no reset effect is needed.
  const viewKey = `${level}|${states.length}|${lgas.length}|${wards.length}|${pollingUnits.length}`;
  const [pageState, setPageState] = useState({ key: viewKey, page: 1 });
  const currentPage = pageState.key === viewKey ? pageState.page : 1;

  const aggRows: AggRow[] =
    level === "national"
      ? states.map((s) => ({ ...s, open: () => onOpenState(s.code) }))
      : level === "state"
      ? lgas.map((l) => ({ ...l, open: () => onOpenLga(l.code) }))
      : level === "lga"
      ? wards.map((w) => ({ ...w, open: () => onOpenWard(w.code) }))
      : [];

  const totalItems = level === "ward" ? pollingUnits.length : aggRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, totalItems);
  const setPage = (next: number) => setPageState({ key: viewKey, page: next });

  const shownAgg = aggRows.slice(start, end);
  const shownPus = pollingUnits.slice(start, end);

  const title =
    level === "ward"
      ? `Polling units in ${areaName ? toTitleCase(areaName) : "this"} ward`
      : `Breakdown by ${HEADING[level]}`;

  const openPU = (pu: PollingUnitData) => {
    setSelectedPU(pu);
    setIsPUModalOpen(true);
  };

  const handleExportCSV = () => {
    const q = (v: string | number | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows: (string | number | undefined)[][] =
      level === "ward"
        ? [
            ["INEC code", "Polling unit", "Location", "Latitude", "Longitude", "Official agent", "Extra agents"],
            ...pollingUnits.map((p) => [
              p.code,
              p.name,
              p.location,
              p.hasGPS ? p.latitude : "",
              p.hasGPS ? p.longitude : "",
              p.hasOfficialAgent ? p.officialAgentName || "Yes" : "No (gap)",
              p.extraAgents.length,
            ]),
          ]
        : [
            ["Code", HEADING[level], "Total PUs", "With GPS", "Covered", "Coverage %", "Extra agents"],
            ...aggRows.map((r) => [r.code, r.name, r.totalPUs, r.gpsPUs, r.coveredPUs, r.officialAgentPct, r.extraAgentsCount]),
          ];
    const csv = rows.map((r) => r.map(q).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    link.download = `coverage-${(areaName ?? level).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section aria-label={title} className={`${WF.card} flex flex-col overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0F0F0] px-4 py-3">
        <span className="flex items-center gap-2">
          <span className="text-[14px] font-bold text-[#0A0A0A]">{title}</span>
          <span className="rounded-[4px] border border-[#E5E5E5] px-[5px] text-[10px] font-bold uppercase text-[#737373]">
            {LEVEL_TAG[level]}
          </span>
        </span>
        <button type="button" onClick={handleExportCSV} className={`${WF.btnRow} min-h-[30px]`}>
          Export CSV
        </button>
      </div>

      {totalItems === 0 ? (
        <p className="m-0 px-4 py-8 text-center text-[13px] text-[#737373]">No {PLURAL[level]} match these filters.</p>
      ) : level !== "ward" ? (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className={`${WF.table} min-w-[760px]`}>
              <thead>
                <tr>
                  <th scope="col" className={`${WF.th} pl-4`}>
                    Code
                  </th>
                  <th scope="col" className={WF.th}>
                    {HEADING[level]}
                  </th>
                  <th scope="col" className={WF.th}>
                    Total PUs
                  </th>
                  <th scope="col" className={WF.th}>
                    With GPS
                  </th>
                  <th scope="col" className={WF.th} title="A polling unit is covered when it has 1 official agent">
                    Official coverage *
                  </th>
                  <th scope="col" className={WF.th} title="Agents on top of the official agent; they never change coverage">
                    Extra agents *
                  </th>
                  <th scope="col" className={`${WF.th} pr-4 text-right`}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {shownAgg.map((r) => (
                  <tr key={r.code} className={WF.tr}>
                    <td className={`${WF.td} pl-4 tabular-nums text-[#737373]`}>{r.code}</td>
                    <td className={`${WF.td} font-semibold`}>{toTitleCase(r.name)}</td>
                    <td className={`${WF.td} tabular-nums`}>{fmt(r.totalPUs)}</td>
                    <td className={`${WF.td} tabular-nums text-[#525252]`}>
                      {fmt(r.gpsPUs)} ({pctOf(r.gpsPUs, r.totalPUs)}%)
                    </td>
                    <td className={WF.td}>
                      <span className="flex max-w-[160px] flex-col gap-[3px]">
                        <span className="flex justify-between gap-2 tabular-nums">
                          <span className="font-semibold text-[#1E8A55]">{r.officialAgentPct}%</span>
                          <span className="text-[11px] text-[#737373]">
                            {fmt(r.coveredPUs)} / {fmt(r.totalPUs)}
                          </span>
                        </span>
                        <Bar pct={r.officialAgentPct} />
                      </span>
                    </td>
                    <td className={`${WF.td} tabular-nums text-[#6D28D9]`}>{fmt(r.extraAgentsCount)}</td>
                    <td className={`${WF.td} pr-4 text-right`}>
                      <button type="button" onClick={r.open} className={WF.btnRow}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col md:hidden">
            {shownAgg.map((r) => (
              <button
                key={r.code}
                type="button"
                onClick={r.open}
                className="flex w-full flex-col gap-1.5 border-0 border-t border-[#F0F0F0] bg-white px-3.5 py-3 text-left text-[#0A0A0A] first:border-t-0"
              >
                <span className="flex w-full justify-between gap-2">
                  <span className="text-[14px] font-semibold">
                    {r.code} · {toTitleCase(r.name)}
                  </span>
                  <span className="text-[13px] font-bold text-[#1E8A55]">{r.officialAgentPct}%</span>
                </span>
                <Bar pct={r.officialAgentPct} className="w-full" />
                <span className="text-[12px] text-[#737373]">
                  {fmt(r.coveredPUs)} / {fmt(r.totalPUs)} units · GPS {fmt(r.gpsPUs)} ({pctOf(r.gpsPUs, r.totalPUs)}%) ·{" "}
                  {fmt(r.extraAgentsCount)} extra
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className={`${WF.table} min-w-[780px]`}>
              <thead>
                <tr>
                  <th scope="col" className={`${WF.th} pl-4`}>
                    INEC code
                  </th>
                  <th scope="col" className={WF.th}>
                    Polling unit &amp; location
                  </th>
                  <th scope="col" className={WF.th} title="Whether INEC's register has this polling unit's GPS position">
                    Has coordinates
                  </th>
                  <th scope="col" className={WF.th}>
                    Official agent status *
                  </th>
                  <th scope="col" className={WF.th}>
                    Extra agents *
                  </th>
                  <th scope="col" className={`${WF.th} pr-4 text-right`}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {shownPus.map((pu) => (
                  <tr key={pu.code} className={`${WF.tr} align-top`}>
                    <td className={`${WF.td} pl-4 font-semibold whitespace-nowrap tabular-nums`}>{pu.code}</td>
                    <td className={WF.td}>
                      <PuNameAndLocation pu={pu} />
                    </td>
                    <td className={WF.td}>
                      <CoordinatesPill has={pu.hasGPS} />
                    </td>
                    <td className={WF.td}>
                      <span className="flex flex-col gap-[3px]">
                        <StatusPill covered={pu.hasOfficialAgent} />
                        {pu.officialAgentName ? (
                          <span className="text-[12px] whitespace-nowrap text-[#525252]">
                            {toTitleCase(pu.officialAgentName)}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className={WF.td}>
                      <ExtraChips pu={pu} />
                    </td>
                    <td className={`${WF.td} pr-4 text-right`}>
                      <button type="button" className={WF.btnRow} onClick={() => openPU(pu)}>
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col md:hidden">
            {shownPus.map((pu) => (
              <div key={pu.code} className="flex flex-col gap-1.5 border-t border-[#F0F0F0] px-3.5 py-3 first:border-t-0">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openPU(pu)}
                    className="min-h-8 border-0 bg-transparent p-0 text-[14px] font-bold tabular-nums text-[#0A0A0A] underline"
                  >
                    {pu.code}
                  </button>
                  <StatusPill covered={pu.hasOfficialAgent} />
                </div>
                <span className="text-[14px]">
                  <PuNameAndLocation pu={pu} showNoGpsNote />
                </span>
                <ExtraChips pu={pu} hideNone />
              </div>
            ))}
          </div>
        </>
      )}

      {totalItems > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F0F0F0] px-4 py-2.5">
          <span className="text-[12px] text-[#737373]">
            Showing {fmt(start + 1)}–{fmt(end)} of {fmt(totalItems)} {PLURAL[level]}
          </span>
          {totalPages > 1 ? (
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                className={`${WF.btnRow} min-h-[30px]`}
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span className="px-1 text-[12px] text-[#737373]">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className={`${WF.btnRow} min-h-[30px]`}
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </span>
          ) : null}
        </div>
      ) : null}

      <PUDetailDrawer pu={selectedPU} open={isPUModalOpen} onOpenChange={setIsPUModalOpen} />
    </section>
  );
}

function mapUrl(pu: PollingUnitData) {
  return `https://www.google.com/maps/search/?api=1&query=${pu.latitude},${pu.longitude}`;
}

function StatusPill({ covered }: { covered: boolean }) {
  return (
    <span
      className={`inline-block flex-none self-start rounded-full px-[9px] py-[3px] text-[12px] font-semibold whitespace-nowrap ${
        covered ? "bg-[#E8F5EE] text-[#1E8A55]" : "bg-[#FDF0E3] text-[#8A3F08]"
      }`}
    >
      {covered ? "Covered" : "No official agent"}
    </span>
  );
}

/** Yes or No: whether INEC's register has the polling unit's GPS position. */
function CoordinatesPill({ has }: { has: boolean }) {
  return (
    <span
      className={`inline-block rounded-full px-[9px] py-[3px] text-[12px] font-semibold whitespace-nowrap ${
        has ? "bg-[#E8F5EE] text-[#1E8A55]" : "bg-[#F4F4F5] text-[#737373]"
      }`}
    >
      {has ? "Yes" : "No"}
    </span>
  );
}

/**
 * The polling unit's name and location. With GPS in the INEC register, both open its position in
 * Google Maps (in a new tab); without, they're plain text (phone cards add a short note).
 */
function PuNameAndLocation({ pu, showNoGpsNote = false }: { pu: PollingUnitData; showNoGpsNote?: boolean }) {
  const name = toTitleCase(pu.name);
  const location = pu.location && pu.location !== pu.name ? pu.location : null;

  if (!pu.hasGPS) {
    return (
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">{name}</span>
        {location ? <span className="text-[11px] text-[#737373]">{location}</span> : null}
        {/* Tables show this in the Has coordinates column; phone cards have no columns. */}
        {showNoGpsNote ? <span className="text-[11px] text-[#A3A3A3]">No GPS in INEC register</span> : null}
      </span>
    );
  }

  return (
    <a
      href={mapUrl(pu)}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open in Google Maps (${pu.latitude.toFixed(4)}, ${pu.longitude.toFixed(4)})`}
      aria-label={`${name}${location ? `, ${location}` : ""}: open in Google Maps (new tab)`}
      className="group flex flex-col gap-0.5 text-[#0A0A0A] no-underline"
    >
      <span className="font-semibold underline decoration-[#D4D4D4] underline-offset-2 group-hover:decoration-[#0A0A0A]">
        {name}
        <span aria-hidden="true" className="ml-1 text-[11px] font-normal text-[#737373]">
          ↗
        </span>
      </span>
      {location ? (
        <span className="text-[11px] text-[#737373] underline decoration-[#E5E5E5] underline-offset-2 group-hover:decoration-[#737373]">
          {location}
        </span>
      ) : null}
    </a>
  );
}

function ExtraChips({ pu, hideNone = false }: { pu: PollingUnitData; hideNone?: boolean }) {
  if (pu.extraAgents.length === 0) return hideNone ? null : <span className="text-[#8A8A8A]">None</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {pu.extraAgents.map((ag) => {
        const owner = ag.owner?.split("·")[0].trim() || "Party";
        const isParty = /\b(party|ndc)\b/i.test(owner);
        return (
          <span
            key={ag.id}
            title={ag.name}
            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              isParty ? "bg-[#F4F4F5] text-[#0A0A0A]" : "bg-[#F3E8FF] text-[#6D28D9]"
            }`}
          >
            Extra · {owner}
          </span>
        );
      })}
    </span>
  );
}
