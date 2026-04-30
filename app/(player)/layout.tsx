import type { ReactNode } from "react";

import { MobileShell } from "@/components/layout/MobileShell";
import { NotificationsBell } from "@/components/nav/NotificationsBell";
import { PlayerBottomNav } from "@/components/nav/PlayerBottomNav";
import { TopBar } from "@/components/nav/TopBar";
import { ClubSwitcher } from "@/components/player/ClubSwitcher";
import { DynamicSyncBadge } from "@/components/player/DynamicSyncBadge";
import { NoviceBadge } from "@/components/player/NoviceBadge";
import { getCurrentMemberships } from "@/lib/auth/memberships";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getAuthContext, requireRole } from "@/lib/auth/role";
import { getInitialNotifications } from "@/lib/notifications/_data";

export default async function PlayerLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Defence-in-depth: middleware already redirected wrong roles. Re-check here
  // so a missing middleware rule can't leak.
  await requireRole(["player", "club_admin", "super_admin"]);

  // Both fetchers are React.cache-wrapped so any nested page reading the
  // same data shares this render's queries. NoviceBadge + ClubSwitcher
  // both render conditionally on their own data, so render unconditionally.
  // Phase 11 / 11-5b: getInitialNotifications produces both the
  // PlayerBottomNav unread-dot count and the bell's SSR snapshot in a
  // single round-trip — no separate countUnreadNotifications helper.
  const [profile, memberships, ctx, initialNotifications] = await Promise.all([
    getCurrentProfile(),
    getCurrentMemberships(),
    getAuthContext(),
    getInitialNotifications(),
  ]);

  return (
    <MobileShell
      header={
        <TopBar
          variant="light"
          left={
            <ClubSwitcher
              memberships={memberships.map((m) => ({
                membership_id: m.membership_id,
                club_id: m.club_id,
                club_name: m.club_name,
                is_primary: m.is_primary,
              }))}
            />
          }
          right={
            <div className="flex items-center gap-1.5">
              <NoviceBadge
                noviceRegisteredAt={profile?.novice_registered_at ?? null}
              />
              {/* DynamicSyncBadge subscribes to the Dexie outbox + wires
                  tap-to-retry on the error state. Mount lives here so every
                  player surface gets live sync state without each surface
                  re-wiring the hook. */}
              <DynamicSyncBadge />
              {/* Phase 11 / 11-5b: realtime notifications bell. SSR
                  snapshot keeps initial paint stable; the hook subscribes
                  to live INSERT/UPDATE deltas on mount. */}
              <NotificationsBell
                profileId={ctx?.userId ?? null}
                initialUnreadCount={initialNotifications.unreadCount}
                initialRecent={initialNotifications.recent}
                variant="light"
              />
            </div>
          }
        />
      }
      nav={
        <PlayerBottomNav
          unreadNotifications={initialNotifications.unreadCount}
        />
      }
    >
      {children}
    </MobileShell>
  );
}
