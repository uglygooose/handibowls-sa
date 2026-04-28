import { redirect } from "next/navigation";

import { getCurrentMemberships } from "@/lib/auth/memberships";
import { requireRole } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";

import { NewTournamentForm } from "./_components/NewTournamentForm";

export default async function NewTournamentPage() {
  await requireRole(["club_admin", "super_admin"]);

  // Need a host club to scope the create against. Club admins author for
  // their primary club; super_admins author against the primary club they
  // happen to be a member of (or — for cross-club authoring — Phase 7
  // doesn't surface a club picker yet, that's Phase-12 polish).
  const memberships = await getCurrentMemberships();
  const primary =
    memberships.find((m) => m.is_primary) ?? memberships[0] ?? null;

  if (!primary) {
    // No active club membership = nothing to create against. Bounce back
    // to the list (which will render the empty-state explaining the
    // missing prerequisite). This is the only viable redirect target since
    // /manage/overview has its own role gates.
    redirect("/manage/tournaments");
  }

  const supabase = await createClient();
  const { data: greens } = await supabase
    .from("greens")
    .select("id, name, rink_count")
    .eq("club_id", primary.club_id)
    .eq("active", true)
    .order("name", { ascending: true });

  return (
    <NewTournamentForm
      hostClub={{
        id: primary.club_id,
        name: primary.club_name,
      }}
      greens={greens ?? []}
    />
  );
}
