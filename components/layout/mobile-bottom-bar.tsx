"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MapPin,
  Users,
  UserCheck,
  Radio,
  Contact,
} from "lucide-react";

export function MobileBottomBar() {
  const pathname = usePathname();

  const isLinkActive = (path: string) => {
    if (path === "/coverage") {
      return pathname === "/" || pathname === "/coverage";
    }
    return pathname.startsWith(path);
  };

  const navItems = [
    { href: "/coverage", label: "Coverage", icon: MapPin },
    { href: "/candidates", label: "Candidates", icon: Users },
    { href: "/agents", label: "Agents", icon: UserCheck },
    { href: "/broadcasts", label: "Broadcasts", icon: Radio },
    { href: "/recipients", label: "Recipients", icon: Contact },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 shadow-lg safe-bottom">
      <div className="grid grid-cols-5 gap-1 items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isLinkActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-lg transition-all ${
                active
                  ? "text-emerald-800 font-bold bg-emerald-50/70"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-medium"
              }`}
            >
              <div className="relative">
                <Icon className={`h-4 w-4 ${active ? "text-emerald-700 stroke-[2.5]" : "text-slate-500"}`} />
                {active && (
                  <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[56px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
