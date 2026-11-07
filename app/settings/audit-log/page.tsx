"use client";

import { AdminGate } from "@/components/settings/admin-gate";
import { AuditLog } from "@/components/settings/audit-log";

/** Settings · Audit log: who did what. Admins only. */
export default function AuditLogPage() {
  return (
    <AdminGate title="Audit log" loading="Loading the audit log…">
      <AuditLog />
    </AdminGate>
  );
}
