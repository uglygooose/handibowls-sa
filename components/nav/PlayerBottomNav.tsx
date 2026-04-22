"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Home, Play, CalendarPlus, Trophy, User } from "lucide-react";

import { cn } from "@/lib/utils";

export type PlayerNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const DEFAULT_PLAYER_ITEMS: PlayerNavItem[] = [
  { href: "/play/home", label: "Home", icon: Home },
  { href: "/play/play", label: "Play", icon: Play },
  { href: "/play/book", label: "Book", icon: CalendarPlus },
  { href: "/play/tournaments", label: "Tourneys", icon: Trophy },
  { href: "/play/me", label: "Me", icon: User },
];

type Props = {
  items?: PlayerNavItem[];
  className?: string;
};

export function PlayerBottomNav({
  items = DEFAULT_PLAYER_ITEMS,
  className,
}: Props) {
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
      <ul className="grid h-full grid-cols-5">
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
