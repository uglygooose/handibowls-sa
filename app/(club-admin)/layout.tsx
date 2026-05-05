import type { ReactNode } from "react";

import { CommandPaletteMount } from "@/components/command/CommandPaletteMount";
import { AdminSidebar } from "@/components/nav/AdminSidebar";
import { MobileAdminNavTrigger } from "@/components/nav/MobileAdminNavTrigger";
import { NotificationsBell } from "@/components/nav/NotificationsBell";
import { TopBar } from "@/components/nav/TopBar";
import { getCurrentHostClub } from "@/lib/auth/memberships";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getAuthContext, requireRole } from "@/lib/auth/role";
import { getInitialNotifications } from "@/lib/notifications/_data";

export default async function ClubAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["club_admin", "super_admin"]);

  // Foot-card identity. Club admins see their host club + role; the bowl
  // tints to the host club's theme preset (matching the page's overall
  // ThemeApplier output, since both ultimately read from the same
  // club_admin_assignments row for club_admins). super_admins fall through
  // to deriveDisplayName(profile) — they have no canonical host club, so
  // the foot card shows their user identity instead.
  const [hostClub, profile, ctx, initialNotifications] = await Promise.all([
    getCurrentHostClub(),
    getCurrentProfile(),
    getAuthContext(),
    getInitialNotifications(),
  ]);

  const identity = {
    primary: hostClub?.club_name ?? deriveDisplayName(profile),
    role: "Club Admin",
    // Drives both the foot bowl AND the top-right splatter accent,
    // both of which track the active club's preset in lock-step with
    // the page's ThemeApplier output.
    decorPreset: hostClub?.club_theme_preset,
    bowlSeed: hostClub?.club_id,
  };

  return (
    <div className="flex min-h-dvh bg-surface">
      {/* Phase 13 / 13-1 / commit 3: was wrapped in `<aside>`; demoted to
          plain div because AdminSidebar itself uses `<aside>` as its outer
          element. Nested aside elements trip axe's
          landmark-complementary-is-top-level rule on every admin route. */}
      <div className="hidden lg:block">
        <AdminSidebar variant="club_admin" identity={identity} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          variant="light"
          left={<MobileAdminNavTrigger variant="club_admin" identity={identity} />}
          right={
            // Phase 11 / 11-5b: club admins are also club members and
            // receive their own broadcasts (a club admin who broadcasts
            // appears in their own audience under all_members). Bell
            // mounts here for the same realtime contract as players.
            <NotificationsBell
              profileId={ctx?.userId ?? null}
              role="club_admin"
              initialUnreadCount={initialNotifications.unreadCount}
              initialRecent={initialNotifications.recent}
              variant="light"
            />
          }
        />
        <div className="bg-surface-muted px-4 py-2 text-xs text-ink-muted lg:hidden">
          Admin features are optimised for desktop.
        </div>
        <main id="main-content" className="flex-1 overflow-x-hidden">{children}</main>
      </div>
      <CommandPaletteMount />
    </div>
  );
}

function deriveDisplayName(
  profile: { display_name?: string | null; first_name?: string | null; last_name?: string | null } | null,
): string {
  if (!profile) return "Signed in";
  if (profile.display_name) return profile.display_name;
  const parts = [profile.first_name, profile.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : "Signed in";
}
