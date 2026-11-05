export const NOT_AVAILABLE_YET = "Not available yet";

/** Formats API-provided coverage numbers as "6,265 of 13,325 (47%)". */
export function formatCoverage(covered: number, total: number, pct: number): string {
  return `${covered.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} (${pct}%)`;
}

export type OfficialAndExtraCounts = { official: number; extra: number };

/** Counts agents by kind. Extras never count towards official coverage. */
export function countAgentsByKind(
  agents: ReadonlyArray<{ agentKind: "official" | "extra" }>,
): OfficialAndExtraCounts {
  let official = 0;
  let extra = 0;
  for (const agent of agents) {
    if (agent.agentKind === "official") official += 1;
    else if (agent.agentKind === "extra") extra += 1;
  }
  return { official, extra };
}

/** Channel status label; a missing status is never guessed. */
export function channelStatusLabel(
  status: "connected" | "sms_only" | "not_matched" | null | undefined,
): string {
  if (status === "connected") return "Telegram Connected";
  if (status === "sms_only") return "SMS Only";
  if (status === "not_matched") return "Not Matched";
  return NOT_AVAILABLE_YET;
}
