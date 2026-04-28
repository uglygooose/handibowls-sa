"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Building2,
  ChevronLeft,
  ClipboardList,
  LayoutDashboard,
  Map,
  MapPin,
  MessageSquare,
  Settings,
  Trophy,
  Users,
  UsersRound,
} from "lucide-react";

import { HandiBowlsMark } from "@/components/brand/HandiBowlsMark";
import { HandiBowlsWordmark } from "@/components/brand/HandiBowlsWordmark";
import { SpeckleLayer } from "@/components/brand/SpeckleLayer";
import { SplatterAccent } from "@/components/brand/SplatterAccent";
import { cn } from "@/lib/utils";

export type AdminSidebarItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
};

export type AdminSidebarSection = {
  label: string;
  items: AdminSidebarItem[];
};

// Sidebar nav grouped by section, per the Claude Design treatment. Each
// section gets a font-mono uppercase header with a bottom border. Disabled
// items render greyed out and don't navigate — used for surfaces that
// aren't built yet (Settings, Audit log).
const PLATFORM_SECTIONS: AdminSidebarSection[] = [
  {
    label: "Platform",
    items: [
      { href: "/platform/clubs", label: "Clubs", icon: Building2 },
      { href: "/platform/districts", label: "Districts", icon: Map },
      { href: "/platform/tournaments", label: "Tournaments", icon: Trophy },
      { href: "/platform/rubrics", label: "Rubrics", icon: ClipboardList },
      { href: "/platform/users", label: "Users", icon: UsersRound },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/platform/settings", label: "Settings", icon: Settings, disabled: true },
      { href: "/platform/audit", label: "Audit log", icon: Activity, disabled: true },
    ],
  },
];

// Club-admin sidebar keeps its current minimal treatment; full design pass
// for club-admin chrome is owned by Phase 7 (the design output only addressed
// the super-admin platform surface in this commit).
const CLUB_ADMIN_SECTIONS: AdminSidebarSection[] = [
  {
    label: "Manage",
    items: [
      { href: "/manage/overview", label: "Overview", icon: LayoutDashboard },
      { href: "/manage/members", label: "Members", icon: Users },
      { href: "/manage/greens", label: "Greens", icon: MapPin },
      { href: "/manage/tournaments", label: "Tournaments", icon: Trophy },
      { href: "/manage/t20", label: "T20", icon: ClipboardList },
      { href: "/manage/messages", label: "Messages", icon: MessageSquare },
    ],
  },
];

type Props = {
  variant: "club" | "platform";
  // Identity surfaced in the foot card. Layouts pass the signed-in user's
  // display name; the role label is derived from variant.
  userInitial?: string;
  userName?: string;
  className?: string;
  defaultCollapsed?: boolean;
};

export function AdminSidebar({
  variant,
  userInitial = "?",
  userName = "Signed in",
  className,
  defaultCollapsed = false,
}: Props) {
  const sections =
    variant === "platform" ? PLATFORM_SECTIONS : CLUB_ADMIN_SECTIONS;
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const roleLabel = variant === "platform" ? "Super admin" : "Club admin";

  return (
    <aside
      data-slot="admin-sidebar"
      data-collapsed={collapsed}
      className={cn(
        "relative flex h-dvh flex-col overflow-hidden border-r text-sidebar-foreground transition-[width] duration-200",
        "bg-[#0a0a0a] border-[#1a1a1a]",
        collapsed ? "w-16" : "w-64",
        className,
      )}
    >
      {/* Speckle backing — the texture that resolves the black-on-black
          contrast issue noted in Phase 3 follow-up. Faint enough not to
          fight content but visible enough to mark the surface as branded. */}
      <SpeckleLayer
        seed="admin-sidebar"
        density="high"
        opacity={0.055}
        className="z-0"
      />

      {/* Atomic Red splatter top-right corner — same brand accent across
          super-admin and club-admin variants because the splatter is
          brand decoration, not theme-driven. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-5 z-0 opacity-[0.35]"
      >
        <SplatterAccent preset="atomic-red" variant={2} size={140} rotate={-18} />
      </div>

      {/* Brand row */}
      <div className="relative z-10 flex min-h-14 items-center gap-2 px-4 py-4">
        <div className="flex min-w-0 flex-1 items-center">
          {collapsed ? (
            <HandiBowlsMark size={28} />
          ) : (
            <HandiBowlsWordmark variant="dark" height={22} />
          )}
        </div>
      </div>

      {/* Sections */}
      <nav
        aria-label="Admin navigation"
        className="relative z-10 flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2"
      >
        {sections.map((section) => (
          <div key={section.label}>
            <div
              className={cn(
                "mx-1.5 mb-1.5 mt-2 px-2.5 pt-3.5 pb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/40",
                "border-b border-white/5",
                collapsed && "border-b-0 px-0 pt-3 pb-1 text-center",
              )}
              aria-hidden={collapsed ? "true" : undefined}
            >
              {collapsed ? "·" : section.label}
            </div>
            {section.items.map((item) => {
              const isActive =
                !item.disabled &&
                (pathname === item.href || pathname.startsWith(item.href + "/"));
              const Icon = item.icon;
              const content = (
                <>
                  <Icon className="size-[18px] shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </>
              );

              if (item.disabled) {
                return (
                  <span
                    key={item.href}
                    aria-disabled="true"
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex h-11 cursor-not-allowed items-center gap-3 rounded-[10px] px-3 text-sm font-medium",
                      "text-sidebar-foreground/40",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    {content}
                  </span>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary-500 font-semibold text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.18)]"
                      : "text-sidebar-foreground/70 hover:bg-[rgba(215,38,30,0.1)] hover:text-white",
                    collapsed && "justify-center px-0",
                  )}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Foot — avatar + role label + collapse toggle */}
      <div className="relative z-10 flex items-center gap-2.5 border-t border-white/8 p-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-500 font-display text-sm font-extrabold text-white">
          {userInitial}
        </div>
        {!collapsed && (
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <strong className="truncate text-[13px] font-semibold text-white">
              {userName}
            </strong>
            <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-sidebar-foreground/50">
              {roleLabel}
            </span>
          </div>
        )}
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-md",
            "bg-white/5 text-sidebar-foreground/60 hover:bg-white/12 hover:text-white",
          )}
        >
          <ChevronLeft
            className={cn("size-4 transition-transform", collapsed && "rotate-180")}
          />
        </button>
      </div>
    </aside>
  );
}
