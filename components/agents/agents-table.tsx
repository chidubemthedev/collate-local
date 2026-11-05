"use client";

import React, { useState, useMemo } from "react";
import { UnifiedAgentRecord, AgentDetailModal } from "./agent-detail-modal";
import { WF, Pill, EmptyBox, type Tone } from "@/components/ui/wf";
import { toTitleCase } from "@/components/candidates/candidates-filters";

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

  // Back to the first page when the agent dataset changes (e.g. filters applied).
  // The page is stored with the dataset size it belongs to, so no reset effect is needed.
  const [pageState, setPageState] = useState({ key: agents.length, page: 1 });
  const currentPage = pageState.key === agents.length ? pageState.page : 1;
  const setPage = (page: number) => setPageState({ key: agents.length, page });

  const totalPages = Math.max(1, Math.ceil(agents.length / PAGE_SIZE));
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, agents.length);
  const rows = useMemo(() => agents.slice(start, end), [agents, start, end]);

  const open = (agent: UnifiedAgentRecord) => {
    setSelectedAgent(agent);
    setIsModalOpen(true);
  };

  if (agents.length === 0) {
    return <EmptyBox>No agent records match these filters.</EmptyBox>;
  }

  const actionButton = (agent: UnifiedAgentRecord, phone = false) => {
    const gap = agent.type === "gap";
    return (
      <button
        type="button"
        onClick={() => open(agent)}
        className={`${WF.btnRow} ${gap ? "border-[#171717] bg-[#171717] text-[#FAFAFA] hover:bg-[#262626]" : ""} ${
          phone ? "min-h-9 self-end" : ""
        }`}
      >
        {gap ? "Assign" : "Inspect"}
      </button>
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
                    <span className="flex flex-col gap-0.5">
                      <span className="font-semibold">{toTitleCase(agent.puName)}</span>
                      <span className="text-[11px] text-[#737373]">{toTitleCase(agent.puLocation)}</span>
                    </span>
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
                {toTitleCase(agent.puName)} · <span className="text-[#737373]">{toTitleCase(agent.puLocation)}</span>
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
        agent={selectedAgent}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onAssignOfficial={onAssignOfficial}
      />
    </div>
  );
}
