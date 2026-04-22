"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Home, CalendarPlus, Trophy, User } from "lucide-react";

import { cn } from "@/lib/utils";

export type PlayerNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// Kept co-located with the client component so lucide component references
// never cross the RSC serialization boundary. Keep href prefixes in sync with
// proxy.ts' PLAYER_PREFIXES.
const PLAYER_NAV_ITEMS: PlayerNavItem[] = [
  { href: "/play", label: "Play", icon: Home },
  { href: "/book", label: "Book", icon: CalendarPlus },
  { href: "/tournaments", label: "Tourneys", icon: Trophy },
  { href: "/me", label: "Me", icon: User },
];

type Props = {
  className?: string;
};

export function PlayerBottomNav({ className }: Props) {
  const items = PLAYER_NAV_ITEMS;
  const pathname = usePathname();

  return (
    <nav
      data-slot="player-bottom-nav"
      aria-label="Player navigation"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 h-16 border-t border-border bg-surface",
        "pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <ul className="grid h-full grid-cols-4">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <li key={item.href} className="contents">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-full min-h-11 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
                  isActive
                    ? "text-primary-500"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                <Icon
                  className={cn("size-5 shrink-0", isActive && "stroke-[2.5]")}
                  aria-hidden="true"
                />
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
