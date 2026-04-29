import "server-only";

import { getAuthContext } from "@/lib/auth/role";
import { formatRinkLabel, type RinkEmbed } from "@/lib/format/rink";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type DbMatch = Database["public"]["Tables"]["matches"]["Row"];
type DbTournament = Database["public"]["Tables"]["tournaments"]["Row"];

// Phase 8a — player home /play data fetchers. Three queries, all
// RLS-scoped to the caller (player can read their own profile,
// notifications, and matches where they're a team member).
//
// Why a fresh `_data.ts` rather than a shared player-data layer:
//   • The /play home is the only surface that wants the *next* match
//     and *recent* results in one place. /tournaments lists across
//     all entries; the scorecard is per-match. Sharing a helper would
//     pull in counts/columns the home doesn't need.
//   • Separation matches the Phase 7 admin pattern where each route
//     owns its `_data.ts`.

export type PlayerNextMatch = {
  match_id: string;
  match_no: number | null;
  round: number | null;
  rink: string | null;
  status: DbMatch["status"];
  finalized_by_admin: boolean;
  home_shots: number;
  away_shots: number;
  player_is_home: boolean;
  opponent_name: string;
  /** "Round 2 — QF" / "Final" / "Round 1" — derived from round + bracket position. */
  round_label: string;
  tournament: {
    id: string;
    name: string;
    format: DbTournament["format"];
    structure: DbTournament["structure"];
    handicap_rule: DbTournament["handicap_rule"];
    shots_up_target: number | null;
    ends_per_match: number | null;
    host_club_theme: Database["public"]["Enums"]["club_theme_preset"];
  };
};

export type PlayerRecentResult = {
  match_id: string;
  match_no: number | null;
  /** "W" win / "L" loss / "P" peel (drawn). */
  outcome: "W" | "L" | "P";
  player_shots: number;
  opponent_shots: number;
  opponent_name: string;
  finished_at: string;
  tournament_id: string;
  tournament_name: string;
};

// Returns the team_ids the current player belongs to. Used to scope
// match queries by team membership without re-running the JWT-claim path.
async function teamIdsForCurrentPlayer(): Promise<string[]> {
  const ctx = await getAuthContext();
  if (!ctx) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournament_team_members")
    .select("team_id")
    .eq("profile_id", ctx.userId);
  return (data ?? []).map((r) => r.team_id);
}

// Earliest non-completed match the player participates in. Order:
// scheduled (earliest starts_at first) → in_progress → null. Returns
// null when no upcoming match — surface renders an empty state.
export async function getNextMatchForCurrentPlayer(): Promise<PlayerNextMatch | null> {
  const teamIds = await teamIdsForCurrentPlayer();
  if (teamIds.length === 0) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select(
      "id, match_no, round, status, finalized_by_admin, home_shots, away_shots, home_team_id, away_team_id, starts_at, rink:rinks(number, green:greens(name)), home_team:tournament_teams!home_team_id(name), away_team:tournament_teams!away_team_id(name), tournament:tournaments(id, name, format, structure, handicap_rule, shots_up_target, ends_per_match, clubs!host_club_id(theme_preset))",
    )
    .or(`home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`)
    .in("status", ["scheduled", "in_progress"])
    .order("starts_at", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const playerIsHome = teamIds.includes(data.home_team_id ?? "");
  const homeTeam = data.home_team as { name?: string } | null;
  const awayTeam = data.away_team as { name?: string } | null;
  const opponent = playerIsHome ? awayTeam : homeTeam;
  const tournament = data.tournament as {
    id: string;
    name: string;
    format: DbTournament["format"];
    structure: DbTournament["structure"];
    handicap_rule: DbTournament["handicap_rule"];
    shots_up_target: number | null;
    ends_per_match: number | null;
    clubs: { theme_preset: Database["public"]["Enums"]["club_theme_preset"] } | null;
  } | null;

  return {
    match_id: data.id,
    match_no: data.match_no,
    round: data.round,
    rink: formatRinkLabel(data.rink as RinkEmbed),
    status: data.status,
    finalized_by_admin: data.finalized_by_admin,
    home_shots: data.home_shots,
    away_shots: data.away_shots,
    player_is_home: playerIsHome,
    opponent_name: opponent?.name ?? "Opponent TBD",
    round_label: roundLabelFor(data.round, tournament?.structure),
    tournament: {
      id: tournament?.id ?? "",
      name: tournament?.name ?? "",
      format: tournament?.format ?? "singles",
      structure: tournament?.structure ?? "knockout",
      handicap_rule: tournament?.handicap_rule ?? "scratch",
      shots_up_target: tournament?.shots_up_target ?? null,
      ends_per_match: tournament?.ends_per_match ?? null,
      host_club_theme: tournament?.clubs?.theme_preset ?? "atomic-red",
    },
  };
}

// Last N completed matches the player participated in. Default 5 for
// the home strip. Caller can request more for the profile/results page.
export async function getRecentResultsForCurrentPlayer(
  limit = 5,
): Promise<PlayerRecentResult[]> {
  const teamIds = await teamIdsForCurrentPlayer();
  if (teamIds.length === 0) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select(
      "id, match_no, home_shots, away_shots, home_team_id, away_team_id, ends_at, updated_at, home_team:tournament_teams!home_team_id(name), away_team:tournament_teams!away_team_id(name), tournament:tournaments(id, name)",
    )
    .or(`home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`)
    .eq("status", "completed")
    .order("ends_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (!data) return [];

  return data.map((m) => {
    const playerIsHome = teamIds.includes(m.home_team_id ?? "");
    const playerShots = playerIsHome ? m.home_shots : m.away_shots;
    const opponentShots = playerIsHome ? m.away_shots : m.home_shots;
    const homeTeam = m.home_team as { name?: string } | null;
    const awayTeam = m.away_team as { name?: string } | null;
    const opponent = playerIsHome ? awayTeam : homeTeam;
    const tournament = m.tournament as { id: string; name: string } | null;
    const outcome: PlayerRecentResult["outcome"] =
      playerShots > opponentShots ? "W" : playerShots < opponentShots ? "L" : "P";
    return {
      match_id: m.id,
      match_no: m.match_no,
      outcome,
      player_shots: playerShots,
      opponent_shots: opponentShots,
      opponent_name: opponent?.name ?? "Opponent",
      finished_at: m.ends_at ?? m.updated_at,
      tournament_id: tournament?.id ?? "",
      tournament_name: tournament?.name ?? "",
    };
  });
}

// Unread-notification count for the unread dot on the Me tab + the
// banner at the top of /play. Tiny query, cached per request via the
// natural Server Component dedup.
export async function getUnreadNotificationCount(): Promise<number> {
  const ctx = await getAuthContext();
  if (!ctx) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", ctx.userId)
    .eq("read", false);
  return count ?? 0;
}

// Round labels — derived from tournament.structure + match.round.
// Knockout: "Round N", "Semis" (penultimate), "Final" (last). For round-
// robin / drawn social we just say "Round N" since there's no bracket
// terminology. Fallback to "Round 1" when round is null.
function roundLabelFor(
  round: number | null,
  structure: DbTournament["structure"] | undefined,
): string {
  if (round == null) return "Round 1";
  // The home page doesn't know the bracket size, so we can't tell semis
  // from final from "Round N" without another query. Phase-8b detail page
  // surfaces the precise label; here a clean number is enough.
  if (structure === "knockout") return `Round ${round}`;
  return `Round ${round}`;
}
