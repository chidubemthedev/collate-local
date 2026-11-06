"use client";

import React from "react";
import type { AgentListItem } from "@/types/api";
import { WF, Pill, EmptyBox } from "@/components/ui/wf";
import { toTitleCase } from "@/components/candidates/candidates-filters";

interface RecipientsTableProps {
  recipients: AgentListItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

const TH = "sticky top-0 z-[1] border-b border-[#E5E5E5] bg-white px-3.5 py-2.5 text-left text-[12px] font-bold whitespace-nowrap text-[#525252]";
const TD = "px-3.5 py-2.5";

/** Group badge: square-cornered, dashed, as in the wireframe. */
function GroupBadge({ kind }: { kind: AgentListItem["agentKind"] }) {
  return kind === "official" ? (
    <span className="inline-block rounded-[4px] border border-dashed border-[#1E8A55] bg-[#E8F5EE] px-1.5 py-px text-[12px] font-semibold text-[#1E8A55]">
      Official agent
    </span>
  ) : (
    <span className="inline-block rounded-[4px] border border-dashed border-[#6D28D9] bg-[#F3E8FF] px-1.5 py-px text-[12px] font-semibold text-[#6D28D9]">
      Extra agent
    </span>
  );
}

function TelegramPill({ connected }: { connected: boolean }) {
  return connected ? (
    <Pill tone="green" className="px-[9px] py-[3px] text-[12px]">
      On Telegram
    </Pill>
  ) : (
    <Pill tone="grey" className="px-[9px] py-[3px] text-[12px]">
      Not on Telegram
    </Pill>
  );
}

function areaOf(agent: AgentListItem) {
  const unit = agent.pollingUnit;
  return `${unit.inecPollingUnitCode} · ${toTitleCase(unit.wardName)}, ${toTitleCase(unit.lgaName)}`;
}

export function RecipientsTable({ recipients, isLoading, isError, onRetry }: RecipientsTableProps) {
  if (isLoading) {
    return null;
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 rounded-[10px] border border-[#F5C2C0] bg-[#FDECEC] p-3 text-[13px] text-[#B42318]"
      >
        <span>Could not load recipients.</span>
        <button type="button" className="border-0 bg-transparent font-semibold underline" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (recipients.length === 0) {
    return <EmptyBox>Nobody matches these filters.</EmptyBox>;
  }

  return (
    <>
      <div className={`${WF.card} hidden max-h-[640px] overflow-auto md:block`}>
        <table className={WF.table}>
          <thead>
            <tr>
              <th scope="col" className={TH}>
                Name
              </th>
              <th scope="col" className={TH}>
                Group
              </th>
              <th scope="col" className={TH}>
                Area
              </th>
              <th scope="col" className={TH}>
                Phone *
              </th>
              <th scope="col" className={TH}>
                Telegram *
              </th>
              <th scope="col" className={TH}>
                Owner
              </th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((agent) => (
              <tr key={agent.assignmentId} className={WF.tr}>
                <td className={`${TD} font-semibold`}>{toTitleCase(agent.fullName)}</td>
                <td className={TD}>
                  <GroupBadge kind={agent.agentKind} />
                </td>
                <td className={`${TD} tabular-nums`}>{areaOf(agent)}</td>
                <td className={`${TD} whitespace-nowrap tabular-nums`}>{agent.maskedPhone ?? "No phone on file"}</td>
                <td className={`${TD} whitespace-nowrap`}>
                  <TelegramPill connected={agent.telegramConnected} />
                </td>
                <td className={`${TD} text-[12px] whitespace-nowrap text-[#737373]`}>{agent.owner.displayName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {recipients.map((agent) => (
          <div
            key={agent.assignmentId}
            className="flex flex-col gap-1.5 rounded-[10px] border border-[#E5E5E5] bg-white px-3.5 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[15px] font-semibold">{toTitleCase(agent.fullName)}</span>
              <TelegramPill connected={agent.telegramConnected} />
            </div>
            <span className="text-[13px] text-[#525252]">
              <GroupBadge kind={agent.agentKind} /> · {areaOf(agent)}
            </span>
            <span className="text-[13px] tabular-nums">{agent.maskedPhone ?? "No phone on file"}</span>
          </div>
        ))}
      </div>
    </>
  );
}
