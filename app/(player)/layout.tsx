import type { ReactNode } from "react";

import { MobileShell } from "@/components/layout/MobileShell";
import { PlayerBottomNav } from "@/components/nav/PlayerBottomNav";
import { TopBar } from "@/components/nav/TopBar";
import { ClubSwitcher } from "@/components/player/ClubSwitcher";
import { NoviceBadge } from "@/components/player/NoviceBadge";
import { getCurrentMemberships } from "@/lib/auth/memberships";
import { getCurrentProfile } from "@/lib/auth/profile";
import { requireRole } from "@/lib/auth/role";

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
  const [profile, memberships] = await Promise.all([
    getCurrentProfile(),
    getCurrentMemberships(),
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
          right={<NoviceBadge noviceRegisteredAt={profile?.novice_registered_at ?? null} />}
        />
      }
      nav={<PlayerBottomNav />}
    >
      {children}
    </MobileShell>
  );
}
