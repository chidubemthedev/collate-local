import { describe, expect, it } from "vitest";
import {
  NOT_AVAILABLE_YET,
  channelStatusLabel,
  countAgentsByKind,
  formatCoverage,
} from "./format";

// Fixed ward polling-units page: 3 of 5 units loaded, summary total comes from the API.
const page = {
  data: [
    { agents: [{ agentKind: "official" as const }, { agentKind: "extra" as const }] },
    { agents: [{ agentKind: "official" as const }] },
    { agents: [{ agentKind: "extra" as const }, { agentKind: "extra" as const }] },
  ],
  meta: { nextCursor: "next", limit: 3 },
};
const summary = { coveredPUs: 6265, totalPUs: 13325, officialAgentPct: 47 };

describe("coverage formatting", () => {
  it("formats the API summary as covered of total (pct)", () => {
    expect(formatCoverage(summary.coveredPUs, summary.totalPUs, summary.officialAgentPct)).toBe(
      "6,265 of 13,325 (47%)",
    );
  });

  it("matches the API percentage rather than recomputing from loaded rows", () => {
    const loadedUnits = page.data.length;
    const loadedCovered = page.data.filter((unit) => countAgentsByKind(unit.agents).official > 0).length;
    expect(loadedUnits).toBeLessThan(summary.totalPUs);
    expect(page.meta.nextCursor).not.toBeNull();
    expect(formatCoverage(summary.coveredPUs, summary.totalPUs, summary.officialAgentPct)).not.toContain(
      `${loadedCovered} of ${loadedUnits}`,
    );
  });
});

describe("countAgentsByKind", () => {
  it("counts official and extra agents separately", () => {
    expect(countAgentsByKind(page.data.flatMap((unit) => unit.agents))).toEqual({
      official: 2,
      extra: 3,
    });
  });

  it("counts extras without an official as zero official coverage", () => {
    expect(countAgentsByKind(page.data[2].agents)).toEqual({ official: 0, extra: 2 });
  });
});

describe("channelStatusLabel", () => {
  it("labels real statuses", () => {
    expect(channelStatusLabel("connected")).toBe("Telegram Connected");
    expect(channelStatusLabel("sms_only")).toBe("SMS Only");
    expect(channelStatusLabel("not_matched")).toBe("Not Matched");
  });

  it("shows Not available yet when the route returns no status", () => {
    expect(channelStatusLabel(null)).toBe(NOT_AVAILABLE_YET);
    expect(channelStatusLabel(undefined)).toBe(NOT_AVAILABLE_YET);
  });
});
