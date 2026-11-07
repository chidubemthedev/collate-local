import { maskEmail } from "@/lib/settings/admins";
import { runningMateTitle, titleCaseName } from "@/lib/auth/view-as";
import type { CandidateInviteItem } from "@/types/api";
import type { CandidateRow } from "./candidates-sql";

/** A candidate row as the Settings · Candidates page shows it. Emails are masked. */
export function toCandidateInviteItem(row: CandidateRow): CandidateInviteItem {
  const isRunningMate = row.principal_candidate_id !== null;
  const pending = row.status === "invited" || row.status === "expired";
  return {
    candidateId: Number(row.id),
    fullName: titleCaseName(row.full_name),
    title: isRunningMate ? runningMateTitle(row.office_name) : row.office_name,
    seat: titleCaseName(row.unit_name),
    principalCandidateId: row.principal_candidate_id === null ? null : Number(row.principal_candidate_id),
    principalName: row.principal_name ? titleCaseName(row.principal_name) : null,
    isRunningMate,
    status: row.status,
    email: maskEmail(row.status === "registered" ? row.person_email : pending ? row.invite_email : null),
    invitedAt: pending && row.invite_created_at ? new Date(row.invite_created_at).toISOString() : null,
    expiresAt: pending && row.invite_expires_at ? new Date(row.invite_expires_at).toISOString() : null,
  };
}
