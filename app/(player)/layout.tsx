import type { ReactNode } from "react";

import { MobileShell } from "@/components/layout/MobileShell";
import { PlayerBottomNav } from "@/components/nav/PlayerBottomNav";
import { TopBar } from "@/components/nav/TopBar";
import { ClubSwitcher } from "@/components/player/ClubSwitcher";
import { DynamicSyncBadge } from "@/components/player/DynamicSyncBadge";
import { NoviceBadge } from "@/components/player/NoviceBadge";
import { getCurrentMemberships } from "@/lib/auth/memberships";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getAuthContext, requireRole } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";

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
  const [profile, memberships, unreadCount] = await Promise.all([
    getCurrentProfile(),
    getCurrentMemberships(),
    countUnreadNotifications(),
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
            </div>
          }
        />
      }
      nav={<PlayerBottomNav unreadNotifications={unreadCount} />}
    >
      {children}
    </MobileShell>
  );
}

// Lightweight count for the bottom-nav unread dot. Lives here rather
// than in /play/_data.ts so the layout doesn't import a route-scoped
// file. Same RLS path; same SSR Supabase client.
async function countUnreadNotifications(): Promise<number> {
  const ctx = await getAuthContext();
  if (!ctx) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", ctx.userId)
    .eq("read", false);
  return count ?? 0;
}
