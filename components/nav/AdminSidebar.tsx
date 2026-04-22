"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ChevronLeft,
  LayoutDashboard,
  Trophy,
  Users,
  CalendarDays,
  Settings,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { HandiBowlsMark } from "@/components/brand/HandiBowlsMark";
import { HandiBowlsWordmark } from "@/components/brand/HandiBowlsWordmark";

export type AdminSidebarItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const DEFAULT_ADMIN_ITEMS: AdminSidebarItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/admin/members", label: "Members", icon: Users },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

type Props = {
  items?: AdminSidebarItem[];
  className?: string;
  defaultCollapsed?: boolean;
};

export function AdminSidebar({
  items = DEFAULT_ADMIN_ITEMS,
  className,
  defaultCollapsed = false,
}: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <aside
      data-slot="admin-sidebar"
      data-collapsed={collapsed}
      className={cn(
        "flex h-dvh flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-16" : "w-64",
        className,
      )}
    >
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-3">
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

      <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto py-3">
        <ul className="flex flex-col gap-0.5 px-2">
          {items.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href + "/"));
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
