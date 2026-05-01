"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Calendar, Home, Target, Trophy, User } from "lucide-react";

import { cn } from "@/lib/utils";

// Phase 8 player surface — final 5-tab bottom navigation. Replaces the
// Phase 3 four-tab placeholder. Tab order + labels match the design
// source's PlayerBottomNav in handibowls/project/player-core.jsx:
//
//   1. Home   → /play          — next match hero, quick actions
//   2. Play   → /tournaments   — tournaments list (Available / Entered)
//   3. Book   → /book          — rink booking
//   4. T20    → /t20           — T20 hub (Phase 10 — page is a stub
//                                until the T20 module lands)
//   5. Me     → /me            — player profile + clubs + settings
//
// Active tab tints to `--color-primary-500` which propagates from the
// active club's theme preset via Phase 3's <ThemeApplier />. Notification
// badge slot lives on the Me tab (the design surfaces unread inbox count
// there, not on a dedicated bell tab).

export type PlayerNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Render the unread-notification badge on this tab. Drives a small
   *  primary-500 dot anchored top-right of the icon — count is read by
   *  the parent layout via a Server Component query (Phase 8a wires this). */
  badgeKey?: "notifications";
};

const PLAYER_NAV_ITEMS: PlayerNavItem[] = [
  { href: "/play", label: "Home", icon: Home },
  { href: "/tournaments", label: "Play", icon: Trophy },
  { href: "/book", label: "Book", icon: Calendar },
  // Compact label "20/20" used here due to 76px tab-width constraint.
  // Canonical "Twenty 20" is used everywhere else per bsa-terminology
  // skill — this is the single documented exception, sized to fit
  // alongside the other 4 short tab labels (Home/Play/Book/Me) without
  // wrapping or overflowing.
  { href: "/t20", label: "20/20", icon: Target },
  { href: "/me", label: "Me", icon: User, badgeKey: "notifications" },
];

type Props = {
  /** Number of unread notifications. Renders the dot on the Me tab when > 0. */
  unreadNotifications?: number;
  className?: string;
};

export function PlayerBottomNav({
  unreadNotifications = 0,
  className,
}: Props) {
  const pathname = usePathname();
  return (
    <nav
      data-slot="player-bottom-nav"
      aria-label="Player navigation"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex h-[76px] border-t border-border bg-bone",
        "pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      {PLAYER_NAV_ITEMS.map((item) => {
        const isActive = isActivePath(pathname, item.href);
        const Icon = item.icon;
        const showBadge =
          item.badgeKey === "notifications" && unreadNotifications > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            data-active={isActive}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1",
              "text-[11px] font-semibold transition-colors",
              isActive ? "text-primary-500" : "text-ink-subtle hover:text-ink",
            )}
          >
            <span className="relative">
              <Icon
                className={cn("size-5 shrink-0", isActive && "stroke-[2.5]")}
                aria-hidden="true"
              />
              {showBadge && (
                <span
                  data-slot="player-nav-unread-dot"
                  data-unread={unreadNotifications}
                  aria-hidden="true"
                  className="absolute -right-1.5 -top-0.5 size-2 rounded-full bg-primary-500 ring-2 ring-bone"
                />
              )}
            </span>
            <span className="leading-none">{item.label}</span>
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute bottom-1.5 size-1 rounded-full bg-primary-500"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

// Treat the home tab strictly as `/play` — otherwise `/play` would also
// match for nested `/play/...` routes, which is fine. Other tabs match
// `/x` and `/x/*`. The /me tab does not match /me/setup (out of nav
// — wizard is its own gate).
function isActivePath(pathname: string, href: string): boolean {
  if (href === "/me") {
    return pathname === "/me" || pathname.startsWith("/me/inbox");
  }
  return pathname === href || pathname.startsWith(href + "/");
}
