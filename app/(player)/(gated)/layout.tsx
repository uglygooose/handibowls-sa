import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getCurrentProfile } from "@/lib/auth/profile";
import { getAuthContext } from "@/lib/auth/role";

// Profile-completion gate. Wraps every (player) route except /me/setup,
// which lives outside this group. Players with profile_completed=false
// bounce to /me/setup; club_admin and super_admin transiting (player)
// surfaces pass through (they're not players, no profile-completion
// expectation applies to them).
//
// Reads via getCurrentProfile() which is React.cache()-wrapped so the
// gate adds zero extra DB hits per render — any nested page (e.g. /me)
// that calls getCurrentProfile reuses the same row.
export default async function GatedPlayerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const ctx = await getAuthContext();
  if (ctx?.role === "player") {
    const profile = await getCurrentProfile();
    if (!profile?.profile_completed) {
      redirect("/me/setup");
    }
  }
  return <>{children}</>;
}
