import { redirect } from "next/navigation";

import { getCurrentHostClub } from "@/lib/auth/memberships";
import { requireRole } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";

import { NewTournamentForm } from "./_components/NewTournamentForm";

export default async function NewTournamentPage() {
  await requireRole(["club_admin", "super_admin"]);

  // Need a host club to scope the create against. Club admins author for
  // their assigned club; super_admins have no canonical host club here
  // (Phase-12 polish will surface a cross-club picker) so they bounce
  // unless they happen to also be an admin somewhere.
  const hostClub = await getCurrentHostClub();

  if (!hostClub) {
    // No host club = nothing to create against. Bounce back to the list
    // (which renders the empty-state explaining the missing prerequisite).
    // This is the only viable redirect target since /manage/overview has
    // its own role gates.
    redirect("/manage/tournaments");
  }

  const supabase = await createClient();
  const { data: greens } = await supabase
    .from("greens")
    .select("id, name, rink_count")
    .eq("club_id", hostClub.club_id)
    .eq("active", true)
    .order("name", { ascending: true });

  return (
    <NewTournamentForm
      hostClub={{
        id: hostClub.club_id,
        name: hostClub.club_name,
      }}
      greens={greens ?? []}
    />
  );
}
