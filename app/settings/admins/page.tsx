"use client";

import { AdminGate } from "@/components/settings/admin-gate";
import { Admins } from "@/components/settings/admins";

/** Settings · Admins: who can sign in as an admin. Admins only. */
export default function AdminsPage() {
  return (
    <AdminGate title="Admins" loading="Loading admins…">
      <Admins />
    </AdminGate>
  );
}
