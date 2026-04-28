import type { ReactNode } from "react";

import { MobileShell } from "@/components/layout/MobileShell";
import { PlayerBottomNav } from "@/components/nav/PlayerBottomNav";
import { TopBar } from "@/components/nav/TopBar";
import { NoviceBadge } from "@/components/player/NoviceBadge";
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

  // Profile read is React.cache-shared with the (gated) layout's gate read,
  // so this adds zero extra DB hits per render. NoviceBadge handles the
  // null-/expired-window cases internally; render it unconditionally.
  const profile = await getCurrentProfile();

  return (
    <MobileShell
      header={
        <TopBar
          variant="light"
          right={<NoviceBadge noviceRegisteredAt={profile?.novice_registered_at ?? null} />}
        />
      }
      nav={<PlayerBottomNav />}
    >
      {children}
    </MobileShell>
  );
}
