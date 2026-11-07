"use client";

import { AdminGate } from "@/components/settings/admin-gate";
import { GroupsAndAccess } from "@/components/settings/groups-and-access";

/** Settings · Groups and access (wireframe 9). Admins only, as in the wireframe. */
export default function SettingsPage() {
  return (
    <AdminGate title="Groups and access" loading="Loading settings…">
      <GroupsAndAccess />
    </AdminGate>
  );
}
