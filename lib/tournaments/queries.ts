import "server-only";

import { createClient } from "@/lib/supabase/server";

// Phase 12.5 / 12.5-5 — tournament-scoped predicate queries.
//
// `tournamentHasScores(tournamentId)` returns true iff any
// `match_ends` row for any match in this tournament has non-zero
// `home_shots` or `away_shots`. Used by the edit page (Section 01)
// to gate the format + structure pickers — once a real score has
// landed, those fields are locked behind an inline notice card.
//
// `match_ends` is the authoritative source. `matches.home_shots /
// away_shots` are denormalised "for quick reads" per the schema
// comment (migration 005, line 113), but they're app-updated rather
// than trigger-synced — a legitimate 0-0 first-end submission would
// have a `match_ends` row while `matches.home_shots` is still 0.
//
// Single PostgREST query: inner-join `match_ends` to `matches`,
// filter the parent table on shots > 0, the embedded relationship
// on tournament_id. The `.or()` filter targets the top-level
// (match_ends) columns; the dot-prefixed `.eq()` targets the
// embedded matches table per the inner-join idiom (Supabase docs:
// "Filter by joined table fields" — joined_table.column).

export async function tournamentHasScores(
  tournamentId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("match_ends")
    .select("id, matches!inner(tournament_id)", {
      count: "exact",
      head: true,
    })
    .eq("matches.tournament_id", tournamentId)
    .or("home_shots.gt.0,away_shots.gt.0");

  if (error) {
    console.error("[tournaments] tournamentHasScores fetch failed:", error);
    // Fail-open: don't lock the edit form on a transient query
    // error. The updateTournament action re-validates server-side
    // before any format/structure write — the UI predicate is just
    // the proactive gate, not the integrity guarantee.
    return false;
  }

  return (count ?? 0) > 0;
}
