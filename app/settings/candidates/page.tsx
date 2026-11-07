"use client";

import { AdminGate } from "@/components/settings/admin-gate";
import { CandidateInvites } from "@/components/settings/candidates";

/** Settings · Candidates: invite candidates and running mates to register. Admins only. */
export default function CandidatesSettingsPage() {
  return (
    <AdminGate title="Candidates" loading="Loading candidates…">
      <CandidateInvites />
    </AdminGate>
  );
}
