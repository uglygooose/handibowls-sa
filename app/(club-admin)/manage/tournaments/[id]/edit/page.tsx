import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import { tournamentHasScores } from "@/lib/tournaments/queries";

import { getTournamentDetail } from "../_data";
import { EditTournamentForm } from "./_components/EditTournamentForm";

// Phase 12.5 / 12.5-5 — tournament edit page. Mirrors the create
// form's 4-section structure (Basics / Rules / Seeding & Greens /
// Entry fee placeholder) pre-filled from the existing tournament
// row. Per the locked-decision in the drift entry: lands on the
// full form (no step state), allows rename after publish with a
// soft-warn near the name field.

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditTournamentPage({ params }: Props) {
  await requireRole(["club_admin", "super_admin"]);
  const { id } = await params;

  // The detail loader does the host-club / RLS scoping check + returns
  // null on either missing-row or wrong-club. notFound() then surfaces
  // a 404 — players + cross-club admins can't see the edit page exists.
  const tournament = await getTournamentDetail(id);
  if (!tournament) notFound();

  const supabase = await createClient();

  // Greens picker — same shape as /new (active greens for the host
  // club, ordered by name).
  const { data: greens } = await supabase
    .from("greens")
    .select("id, name, rink_count")
    .eq("club_id", tournament.host_club_id)
    .eq("active", true)
    .order("name", { ascending: true });

  // Current tournament_greens links → seed the multi-select.
  const { data: currentGreens } = await supabase
    .from("tournament_greens")
    .select("green_id")
    .eq("tournament_id", id);
  const selectedGreenIds = (currentGreens ?? []).map((r) => r.green_id);

  // Format-locked predicate. Server-render the boolean so the form
  // ships pre-decorated with the notice card if scoring has started;
  // the action re-validates server-side on save (defence-in-depth).
  const formatLocked = await tournamentHasScores(id);

  // Soft-warn on rename only after publish — i.e. the row is visible
  // to the public via /tournaments / /tournaments/[id], which kicks
  // in at status='open' (entries publishable) and stays through
  // status='in_progress'. Draft / completed / cancelled rows don't
  // need the warn.
  const softWarnRename =
    tournament.status === "open" || tournament.status === "in_progress";

  return (
    <EditTournamentForm
      tournament={{
        id: tournament.id,
        name: tournament.name,
        scope: tournament.scope,
        format: tournament.format,
        structure: tournament.structure,
        category: tournament.category,
        age_group: tournament.age_group,
        handicap_rule: tournament.handicap_rule,
        seeding_method: tournament.seeding_method,
        starts_at: tournament.starts_at,
        ends_at: tournament.ends_at,
        entries_close_at: tournament.entries_close_at,
        max_entries: tournament.max_entries,
        ends_per_match: tournament.ends_per_match,
        shots_up_target: tournament.shots_up_target,
        fair_rink: tournament.fair_rink ?? true,
        updated_at: tournament.updated_at,
        host_club: {
          id: tournament.host_club.id,
          name: tournament.host_club.name,
        },
      }}
      greens={greens ?? []}
      selectedGreenIds={selectedGreenIds}
      formatLocked={formatLocked}
      softWarnRename={softWarnRename}
    />
  );
}
