import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/role";
import { MobileShell } from "@/components/layout/MobileShell";
import { PlayerBottomNav } from "@/components/nav/PlayerBottomNav";
import { TopBar } from "@/components/nav/TopBar";

export default async function PlayerLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Defence-in-depth: middleware already redirected wrong roles. Re-check here
  // so a missing middleware rule can't leak.
  await requireRole(["player", "club_admin", "super_admin"]);

  return (
    <MobileShell
      header={<TopBar variant="light" />}
      nav={<PlayerBottomNav items={PLAYER_NAV_ITEMS} />}
    >
      {children}
    </MobileShell>
  );
}

// Player bottom nav items. Phase 3 stubs; real link targets land in later
// phases. Keep in sync with middleware's PLAYER_PREFIXES.
import type { PlayerNavItem } from "@/components/nav/PlayerBottomNav";
import { Home, CalendarPlus, Trophy, User } from "lucide-react";

const PLAYER_NAV_ITEMS: PlayerNavItem[] = [
  { href: "/play", label: "Play", icon: Home },
  { href: "/book", label: "Book", icon: CalendarPlus },
  { href: "/tournaments", label: "Tourneys", icon: Trophy },
  { href: "/me", label: "Me", icon: User },
];
