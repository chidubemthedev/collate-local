import type { CandidateData } from "@/lib/types";
import type { Tone } from "@/components/ui/wf";

/** Coverage tier as on the live app: High 50%+, Medium 30–49%, Critical below 30%. */
export function coverageTier(cand: CandidateData): { label: string; tone: Tone; bar: string } {
  if (cand.totalPUs <= 0) return { label: "Not mapped", tone: "muted", bar: "#D4D4D4" };
  if (cand.coveragePct >= 50) return { label: "High", tone: "green", bar: "#22A06B" };
  if (cand.coveragePct >= 30) return { label: "Medium", tone: "amber", bar: "#F59E0B" };
  return { label: "Critical", tone: "red", bar: "#E5484D" };
}

export const CHANNEL_PILL: Record<CandidateData["telegramStatus"], { label: string; tone: Tone }> = {
  connected: { label: "Connected", tone: "green" },
  sms_only: { label: "Invited", tone: "amber" },
  not_matched: { label: "Not connected", tone: "grey" },
};

export function deputyTitle(office: string) {
  return office === "President" ? "Vice-President" : "Deputy";
}

export function coverageText(cand: CandidateData) {
  return cand.totalPUs > 0
    ? `${cand.coveredPUs.toLocaleString()} of ${cand.totalPUs.toLocaleString()} (${cand.coveragePct}%)`
    : "Seat not mapped";
}
