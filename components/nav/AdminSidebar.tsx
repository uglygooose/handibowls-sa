"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ChevronLeft,
  ClipboardList,
  LayoutDashboard,
  Map,
  MapPin,
  MessageSquare,
  Trophy,
  Users,
  UsersRound,
} from "lucide-react";

import { Bowl } from "@/components/brand/Bowl";
import { HandiBowlsMark } from "@/components/brand/HandiBowlsMark";
import { HandiBowlsWordmark } from "@/components/brand/HandiBowlsWordmark";
import { SpeckleLayer } from "@/components/brand/SpeckleLayer";
import type { ThemePreset } from "@/components/brand/ThemeApplier";
import { cn } from "@/lib/utils";

// Phase 7: dual-variant admin sidebar.
//
// `variant: "club_admin" | "super_admin"` matches the role-enum naming so
// callers can pass it through verbatim. The visual chrome is shared (dark
// surface + speckle texture + section label + foot identity card); only the
// nav items + foot copy change between the two.
//
// Active-state colour auto-themes via ThemeApplier (Phase 3): `--color-primary-500`
// flips per `data-theme` on <html>. For club_admin pages this resolves to the
// active user's primary club preset; for super_admin pages it resolves to the
// platform default (Atomic Red unless the page sets its own).

export type AdminSidebarItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Optional badge count rendered when this item is active. */
  badge?: number;
};

const CLUB_ADMIN_ITEMS: AdminSidebarItem[] = [
  { href: "/manage/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/manage/members", label: "Members", icon: Users },
  { href: "/manage/greens", label: "Greens", icon: MapPin },
  { href: "/manage/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/manage/t20", label: "T20", icon: ClipboardList },
  { href: "/manage/messages", label: "Messages", icon: MessageSquare },
];

const SUPER_ADMIN_ITEMS: AdminSidebarItem[] = [
  { href: "/platform/clubs", label: "Clubs", icon: Building2 },
  { href: "/platform/districts", label: "Districts", icon: Map },
  { href: "/platform/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/platform/rubrics", label: "Rubrics", icon: ClipboardList },
  { href: "/platform/users", label: "Users", icon: UsersRound },
];

type Variant = "club_admin" | "super_admin";

type Identity = {
  /** Primary line: club name (club_admin) or user name (super_admin). */
  primary: string;
  /** Secondary line: "Club Admin" / "Super Admin" — uppercase by CSS. */
  role: string;
  /** Theme preset for the foot bowl (club_admin only). Layouts fetch the
   *  active user's primary club preset; ThemeApplier already syncs <html
   *  data-theme> separately, so this is the bowl-specific tint. */
  bowlPreset?: ThemePreset;
  /** Stable seed for the bowl's speckle pattern. Defaults to `primary`. */
  bowlSeed?: string;
};

type Props = {
  variant: Variant;
  identity: Identity;
  className?: string;
  defaultCollapsed?: boolean;
};

export function AdminSidebar({
  variant,
  identity,
  className,
  defaultCollapsed = false,
}: Props) {
  const items = variant === "super_admin" ? SUPER_ADMIN_ITEMS : CLUB_ADMIN_ITEMS;
  const sectionLabel = variant === "super_admin" ? "Platform" : "Club";
  const showBowl = variant === "club_admin";
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <aside
      data-slot="admin-sidebar"
      data-variant={variant}
      data-collapsed={collapsed}
      className={cn(
        "relative flex h-dvh flex-col bg-surface-inverse text-ink-inverse transition-[width] duration-200 border-r border-[#1a1a1a] overflow-hidden",
        collapsed ? "w-16" : "w-64",
        className,
      )}
    >
      {/* Faint speckle texture so the sidebar reads as a branded surface
          rather than a flat black slab. Tints with each preset via the
          theme's --color-speckle-a/b tokens. */}
      <SpeckleLayer
        seed="admin-sidebar"
        density="med"
        opacity={0.07}
        className="z-0"
      />

      <div className="relative z-10 flex h-full flex-col">
        {/* Head — wordmark + collapse toggle. */}
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-[#1a1a1a] px-3">
          <div className="flex min-w-0 flex-1 items-center">
            {collapsed ? (
              <HandiBowlsMark size={32} />
            ) : (
              <HandiBowlsWordmark variant="dark" height={26} />
            )}
          </div>
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((c) => !c)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-inverse/70 hover:bg-[#1a1a1a] hover:text-ink-inverse"
          >
            <ChevronLeft
              className={cn("size-4 transition-transform", collapsed && "rotate-180")}
            />
          </button>
        </div>

        {/* Section label — uppercase eyebrow ("CLUB" / "PLATFORM") + version. */}
        {!collapsed && (
          <div
            data-slot="admin-sidebar-section"
            className="flex items-center justify-between px-[18px] pt-[18px] pb-2 font-display text-[11px] font-bold uppercase tracking-[0.18em] text-ink-inverse/45"
          >
            <span>{sectionLabel}</span>
            <span className="tracking-normal">v7.0</span>
          </div>
        )}

        <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto px-2">
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group flex h-[42px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary-500 font-semibold text-[color:var(--color-on-primary)]"
                        : "text-ink-inverse/[0.78] hover:bg-[#1a1a1a] hover:text-ink-inverse",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {item.badge != null && isActive && (
                          <span className="ml-auto font-mono text-[11px] opacity-70">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Foot — identity card. Bowl on club_admin (themed by ThemeApplier);
            initials avatar otherwise. Hidden when collapsed. */}
        {!collapsed && (
          <div
            data-slot="admin-sidebar-foot"
            className="flex shrink-0 items-center gap-2.5 border-t border-[#1a1a1a] p-[14px]"
          >
            {showBowl && identity.bowlPreset ? (
              <Bowl
                preset={identity.bowlPreset}
                size={36}
                seed={identity.bowlSeed ?? identity.primary}
                emblem={false}
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] font-display text-[13px] font-extrabold text-ink-inverse"
              >
                {primaryInitial(identity.primary)}
              </span>
            )}
            <div className="min-w-0 flex-1 text-[13px]">
              <div className="truncate font-semibold text-ink-inverse">
                {identity.primary}
              </div>
              <div className="font-display text-[11px] font-bold uppercase tracking-[0.12em] text-ink-inverse/55">
                {identity.role}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function primaryInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
