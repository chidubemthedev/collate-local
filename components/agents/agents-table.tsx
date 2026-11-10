"use client";

import React, { useState, useMemo } from "react";
import { UnifiedAgentRecord, AgentDetailModal } from "./agent-detail-modal";
import { WF, Pill, EmptyBox, type Tone } from "@/components/ui/wf";
import { toTitleCase } from "@/components/candidates/candidates-filters";
import { useReadOnly, READ_ONLY_TITLE } from "@/lib/hooks/use-auth";

interface AgentsTableProps {
  agents: UnifiedAgentRecord[];
  onAssignOfficial?: (puCode: string) => void;
}

const PAGE_SIZE = 50;

const TYPE_PILL: Record<UnifiedAgentRecord["type"], { label: string; tone: Tone }> = {
  official: { label: "Official", tone: "green" },
  extra: { label: "Extra", tone: "purple" },
  gap: { label: "Gap", tone: "orange" },
};

const TYPE_TEXT: Record<UnifiedAgentRecord["type"], string> = {
  official: "Official agent",
  extra: "Extra agent",
  gap: "Unfilled",
};

/** Sponsor colours from the wireframe: the party grey, candidates purple, support groups blue. */
function sponsorTone(record: UnifiedAgentRecord): Tone {
  if (/\b(party|ndc)\b/i.test(record.sponsor)) return "grey";
  if (/\b(senat|governor|president|rep|assembly)/i.test(record.sponsor)) return "purple";
  return "sky";
}

/**
 * The polling unit name and location. With coordinates, both are one link to Google Maps (new tab),
 * as on the Coverage table; without, plain text.
 */
function PuNameAndLocation({ record, inline = false }: { record: UnifiedAgentRecord; inline?: boolean }) {
  const name = toTitleCase(record.puName);
  const location = toTitleCase(record.puLocation);
  const { latitude, longitude } = record;
  const linked = record.hasGPS === true && typeof latitude === "number" && typeof longitude === "number";

  if (!linked) {
    return inline ? (
      <>
        {name} · <span className="text-[#737373]">{location}</span>
      </>
    ) : (
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">{name}</span>
        <span className="text-[11px] text-[#737373]">{location}</span>
      </span>
    );
  }

  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open in Google Maps (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`}
      aria-label={`${name}, ${location}: open in Google Maps (new tab)`}
      className={`group text-[#0A0A0A] no-underline ${inline ? "" : "flex flex-col gap-0.5"}`}
    >
      <span
        className={`underline decoration-[#D4D4D4] underline-offset-2 group-hover:decoration-[#0A0A0A] ${
          inline ? "" : "font-semibold"
        }`}
      >
        {name}
        <span aria-hidden="true" className="ml-1 text-[11px] font-normal text-[#737373]">
          ↗
        </span>
      </span>
      {inline ? " · " : null}
      <span
        className={`text-[#737373] underline decoration-[#E5E5E5] underline-offset-2 group-hover:decoration-[#737373] ${
          inline ? "" : "text-[11px]"
        }`}
      >
        {location}
      </span>
    </a>
  );
}

function Contact({ record }: { record: UnifiedAgentRecord }) {
  if (record.type === "gap") return <span className="text-[12px] text-[#A3A3A3]">—</span>;
  return record.telegramStatus === "connected" ? (
    <Pill tone="green">Telegram linked</Pill>
  ) : (
    <Pill tone="grey">Not linked</Pill>
  );
}

export function AgentsTable({ agents, onAssignOfficial }: AgentsTableProps) {
  const [selectedAgent, setSelectedAgent] = useState<UnifiedAgentRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // True when opened from "Add extra", so the popup starts on the extra-agent form.
  const [addingExtra, setAddingExtra] = useState(false);
  const readOnly = useReadOnly();

  // Back to the first page when the agent dataset changes (e.g. filters applied).
  // The page is stored with the dataset size it belongs to, so no reset effect is needed.
  const [pageState, setPageState] = useState({ key: agents.length, page: 1 });
  const currentPage = pageState.key === agents.length ? pageState.page : 1;
  const setPage = (page: number) => setPageState({ key: agents.length, page });

  const totalPages = Math.max(1, Math.ceil(agents.length / PAGE_SIZE));
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, agents.length);
  const rows = useMemo(() => agents.slice(start, end), [agents, start, end]);

  const open = (agent: UnifiedAgentRecord, extra = false) => {
    setSelectedAgent(agent);
    setAddingExtra(extra);
    setIsModalOpen(true);
  };

  if (agents.length === 0) {
    return <EmptyBox>No agent records match these filters.</EmptyBox>;
  }

  // No official agent yet: Assign (the official one). Has an official agent: Inspect, plus Add extra.
  const actionButton = (agent: UnifiedAgentRecord, phone = false) => {
    const gap = agent.type === "gap";
    const size = phone ? "min-h-9" : "";
    return (
      <span className={`inline-flex items-center gap-1.5 ${phone ? "self-end" : ""}`}>
        {agent.type === "official" && agent.puId !== undefined ? (
          <button
            type="button"
            onClick={() => open(agent, true)}
            disabled={readOnly}
            title={readOnly ? READ_ONLY_TITLE : "Add an extra agent at this polling unit"}
            className={`${WF.btnRow} ${size}`}
          >
            Add extra
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => open(agent)}
          className={`${gap ? WF.btnRowDark : WF.btnRow} ${size}`}
        >
          {gap ? "Assign" : "Inspect"}
        </button>
      </span>
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className={`${WF.card} hidden overflow-x-auto md:block`}>
        <table className={`${WF.table} min-w-[960px]`}>
          <thead>
            <tr>
              <th scope="col" className={`${WF.th} pl-4`}>
                PU code
              </th>
              <th scope="col" className={WF.th}>
                Polling unit &amp; location
              </th>
              <th scope="col" className={WF.th}>
                Agent &amp; type *
              </th>
              <th scope="col" className={WF.th}>
                Sponsor / owner *
              </th>
              <th scope="col" className={WF.th}>
                Type *
              </th>
              <th scope="col" className={WF.th}>
                Contact &amp; status *
              </th>
              <th scope="col" className={`${WF.th} pr-4 text-right`}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((agent) => {
              const gap = agent.type === "gap";
              const selected = isModalOpen && selectedAgent?.id === agent.id;
              return (
                <tr key={agent.id} className={`${WF.tr} ${selected ? "bg-[#FAFAFA]" : ""}`}>
                  <td className={`${WF.td} pl-4 font-semibold whitespace-nowrap tabular-nums`}>{agent.puCode}</td>
                  <td className={`${WF.td} min-w-[180px]`}>
                    <PuNameAndLocation record={agent} />
                  </td>
                  <td className={WF.td}>
                    <span className="flex flex-col gap-[3px]">
                      <span className={`font-semibold whitespace-nowrap ${gap ? "text-[#8A3F08]" : ""}`}>
                        {gap ? "No official agent" : toTitleCase(agent.name)}
                      </span>
                      <Pill tone={TYPE_PILL[agent.type].tone}>{TYPE_PILL[agent.type].label}</Pill>
                    </span>
                  </td>
                  <td className={WF.td}>
                    {gap ? (
                      <span className="text-[12px] text-[#A3A3A3]">—</span>
                    ) : (
                      <Pill tone={sponsorTone(agent)}>{agent.sponsor}</Pill>
                    )}
                  </td>
                  <td className={`${WF.td} whitespace-nowrap text-[#525252]`}>{TYPE_TEXT[agent.type]}</td>
                  <td className={`${WF.td} whitespace-nowrap`}>
                    <span className="flex flex-col gap-[3px]">
                      {!gap ? <span className="text-[12px] tabular-nums text-[#737373]">{agent.phoneMasked}</span> : null}
                      <Contact record={agent} />
                    </span>
                  </td>
                  <td className={`${WF.td} pr-4 text-right`}>{actionButton(agent)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {rows.map((agent) => {
          const gap = agent.type === "gap";
          return (
            <div key={agent.id} className={`${WF.card} flex flex-col gap-[5px] px-3.5 py-3`}>
              <span className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold tabular-nums">{agent.puCode}</span>
                <Pill tone={TYPE_PILL[agent.type].tone}>{TYPE_PILL[agent.type].label}</Pill>
              </span>
              <span className="text-[13px]">
                <PuNameAndLocation record={agent} inline />
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {gap ? (
                  <span className="text-[12px] font-semibold text-[#8A3F08]">No official agent</span>
                ) : (
                  <>
                    <span className="text-[12px] font-semibold">{toTitleCase(agent.name)}</span>
                    <Pill tone={sponsorTone(agent)}>{agent.sponsor}</Pill>
                  </>
                )}
                <span className="text-[12px] text-[#525252]">{TYPE_TEXT[agent.type]}</span>
                <Contact record={agent} />
              </span>
              {actionButton(agent, true)}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[12px] text-[#737373]">
          Showing {(start + 1).toLocaleString()}–{end.toLocaleString()} of {agents.length.toLocaleString()} agent records.
        </span>
        {totalPages > 1 ? (
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              className={WF.btnOutline}
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </button>
            <span className="px-1 text-[12px] text-[#737373]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className={WF.btnOutline}
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </button>
          </span>
        ) : null}
      </div>

      <AgentDetailModal
        // A fresh popup per row and button, so it opens on the right form.
        key={`${selectedAgent?.id ?? "none"}:${addingExtra ? "extra" : "view"}`}
        startAddingExtra={addingExtra}
        agent={selectedAgent}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onAssignOfficial={onAssignOfficial}
      />
    </div>
  );
}
