import type { ReactNode } from "react";

import { AdminSidebar } from "@/components/nav/AdminSidebar";
import { MobileAdminNavTrigger } from "@/components/nav/MobileAdminNavTrigger";
import { TopBar } from "@/components/nav/TopBar";
import { getCurrentProfile } from "@/lib/auth/profile";
import { requireRole } from "@/lib/auth/role";

export default async function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["super_admin"]);

  const profile = await getCurrentProfile();
  const identity = {
    primary: deriveDisplayName(profile),
    role: "Super Admin",
  };

  return (
    <div className="flex min-h-dvh bg-surface">
      {/* Phase 13 / 13-1 / commit 3: was wrapped in `<aside>`; demoted to
          plain div because AdminSidebar itself uses `<aside>` as its outer
          element. Avoids landmark-complementary-is-top-level violations. */}
      <div className="hidden lg:block">
        <AdminSidebar variant="super_admin" identity={identity} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          variant="light"
          title="Platform"
          left={<MobileAdminNavTrigger variant="super_admin" identity={identity} />}
        />
        <div className="bg-surface-muted px-4 py-2 text-xs text-ink-muted lg:hidden">
          Platform admin is optimised for desktop.
        </div>
        <main id="main-content" className="flex-1 overflow-x-hidden">{children}</main>
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
