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
    <MobileShell header={<TopBar variant="light" />} nav={<PlayerBottomNav />}>
      {children}
    </MobileShell>
  );
}
