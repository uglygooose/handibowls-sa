import type { ReactNode } from "react";

import { AdminSidebar } from "@/components/nav/AdminSidebar";
import { TopBar } from "@/components/nav/TopBar";
import { getCurrentMemberships } from "@/lib/auth/memberships";
import { getCurrentProfile } from "@/lib/auth/profile";
import { requireRole } from "@/lib/auth/role";

export default async function ClubAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["club_admin", "super_admin"]);

  // Foot-card identity. Club admins see their primary club + role; the bowl
  // tints to the primary club's theme preset (matching the page's overall
  // ThemeApplier output, since both read from the same membership).
  const memberships = await getCurrentMemberships();
  const primary =
    memberships.find((m) => m.is_primary) ?? memberships[0] ?? null;
  const profile = await getCurrentProfile();

  const identity = {
    primary: primary?.club_name ?? deriveDisplayName(profile),
    role: "Club Admin",
    // Drives both the foot bowl AND the top-right splatter accent,
    // both of which track the active club's preset in lock-step with
    // the page's ThemeApplier output.
    decorPreset: primary?.club_theme_preset,
    bowlSeed: primary?.club_id,
  };

  return (
    <div className="flex min-h-dvh bg-surface">
      <aside className="hidden lg:block">
        <AdminSidebar variant="club_admin" identity={identity} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar variant="light" />
        <div className="bg-surface-muted px-4 py-2 text-xs text-ink-muted lg:hidden">
          Admin features are optimised for desktop.
        </div>
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
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
