/** Navigation shared by the desktop sidebar and the phone header, as laid out in the wireframes. */

export type NavSection = "pu" | "msg" | "settings";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  isActive: (pathname: string) => boolean;
}

// Icon paths copied from the wireframes (24px grid, 2px stroke).
const ICON = {
  coverage: "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  candidates:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  agents: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17 11l2 2 4-4",
  broadcasts:
    "M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  compose: "M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z",
  recipients: "M3 4h18v16H3zM8 9a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM6 16c.5-2 2-3 4-3s3.5 1 4 3M15 9h3M15 13h3",
  admins: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
  auditLog: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
};

export const NAV: Record<NavSection, { label: string; href: string; items: NavItem[] }> = {
  pu: {
    label: "Polling Units",
    href: "/coverage",
    items: [
      { href: "/coverage", label: "Coverage", icon: ICON.coverage, isActive: (p) => p === "/" || p.startsWith("/coverage") },
      { href: "/candidates", label: "Candidates", icon: ICON.candidates, isActive: (p) => p.startsWith("/candidates") },
      { href: "/agents", label: "Agents", icon: ICON.agents, isActive: (p) => p.startsWith("/agents") },
    ],
  },
  msg: {
    label: "Messaging",
    href: "/broadcasts",
    items: [
      { href: "/broadcasts", label: "Broadcasts", icon: ICON.broadcasts, isActive: (p) => p.startsWith("/broadcasts") && p !== "/broadcasts/new" },
      { href: "/broadcasts/new", label: "New broadcast", icon: ICON.compose, isActive: (p) => p === "/broadcasts/new" },
      { href: "/recipients", label: "Recipients", icon: ICON.recipients, isActive: (p) => p.startsWith("/recipients") },
    ],
  },
  settings: {
    label: "Settings",
    href: "/settings",
    items: [
      { href: "/settings", label: "Groups and access", icon: ICON.settings, isActive: (p) => p === "/settings" },
      { href: "/settings/admins", label: "Admins", icon: ICON.admins, isActive: (p) => p.startsWith("/settings/admins") },
      { href: "/settings/candidates", label: "Candidates", icon: ICON.candidates, isActive: (p) => p.startsWith("/settings/candidates") },
      { href: "/settings/audit-log", label: "Audit log", icon: ICON.auditLog, isActive: (p) => p.startsWith("/settings/audit-log") },
    ],
  },
};

/** Pages for people who aren't signed in (sign-in, sign-in links, invite links): no navigation shown. */
export function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/login/") || pathname.startsWith("/invite/");
}

export function sectionOf(pathname: string): NavSection {
  if (pathname.startsWith("/settings")) return "settings";
  return pathname.startsWith("/broadcasts") || pathname.startsWith("/recipients") ? "msg" : "pu";
}

export function NavIcon({ path, size = 14 }: { path: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d={path} />
    </svg>
  );
}

export function EyeIcon({ size = 12 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function accessLabel(roles: string[] | undefined, isAdmin: boolean | undefined): string {
  return roles && roles.length ? roles.join(", ") : isAdmin ? "Admin" : "Account";
}
