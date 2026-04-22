"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ChevronLeft,
  LayoutDashboard,
  Users,
  MapPin,
  Trophy,
  ClipboardList,
  MessageSquare,
  Building2,
  Map,
  UsersRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { HandiBowlsMark } from "@/components/brand/HandiBowlsMark";
import { HandiBowlsWordmark } from "@/components/brand/HandiBowlsWordmark";
import { SpeckleLayer } from "@/components/brand/SpeckleLayer";

export type AdminSidebarItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// Keep item arrays co-located here so lucide component references never cross
// the RSC boundary. Layout files pass a `variant` string instead of items.
const CLUB_ADMIN_ITEMS: AdminSidebarItem[] = [
  { href: "/manage/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/manage/members", label: "Members", icon: Users },
  { href: "/manage/greens", label: "Greens", icon: MapPin },
  { href: "/manage/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/manage/t20", label: "T20", icon: ClipboardList },
  { href: "/manage/messages", label: "Messages", icon: MessageSquare },
];

const PLATFORM_ITEMS: AdminSidebarItem[] = [
  { href: "/platform/clubs", label: "Clubs", icon: Building2 },
  { href: "/platform/districts", label: "Districts", icon: Map },
  { href: "/platform/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/platform/rubrics", label: "Rubrics", icon: ClipboardList },
  { href: "/platform/users", label: "Users", icon: UsersRound },
];

type Props = {
  variant: "club" | "platform";
  className?: string;
  defaultCollapsed?: boolean;
};

export function AdminSidebar({
  variant,
  className,
  defaultCollapsed = false,
}: Props) {
  const items = variant === "platform" ? PLATFORM_ITEMS : CLUB_ADMIN_ITEMS;
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <aside
      data-slot="admin-sidebar"
      data-collapsed={collapsed}
      className={cn(
        "relative flex h-dvh flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-16" : "w-64",
        className,
      )}
    >
      {/* Subtle speckle texture so the sidebar reads as a branded surface
          instead of a flat black slab. Uses the theme's speckle-a/b tokens so
          it tints with each preset (red+bone on core-black, black+bone on
          atomic-red, etc). */}
      <SpeckleLayer
        seed="admin-sidebar"
        density="med"
        opacity={0.06}
        className="z-0"
      />

      <div className="relative z-10 flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-3">
        {collapsed ? (
          <HandiBowlsMark size={32} />
        ) : (
          <HandiBowlsWordmark variant="dark" height={28} />
        )}
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "ml-0",
          )}
        >
          <ChevronLeft
            className={cn("size-4 transition-transform", collapsed && "rotate-180")}
          />
        </button>
      </div>

      <nav aria-label="Admin navigation" className="relative z-10 flex-1 overflow-y-auto py-3">
        <ul className="flex flex-col gap-0.5 px-2">
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
                    "group flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <Icon className="size-5 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
