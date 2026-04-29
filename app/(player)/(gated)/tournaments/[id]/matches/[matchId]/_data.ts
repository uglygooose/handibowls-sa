import "server-only";

import { getAuthContext } from "@/lib/auth/role";
import { formatRinkLabel, type RinkEmbed } from "@/lib/format/rink";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

// Phase 8c — match-scoped data for the scorecard surface. Single fetch
// resolving the match + tournament + both teams + the player's role on
// the match (home / away / spectator). RLS is via the existing
// `matches_participant_read` + `matches_host_admin_rw` policies.

type DbMatch = Database["public"]["Tables"]["matches"]["Row"];
type DbTournament = Database["public"]["Tables"]["tournaments"]["Row"];
type DbThemePreset = Database["public"]["Enums"]["club_theme_preset"];
type DbSubmissionStatus = Database["public"]["Enums"]["submission_status"];

export type ScorecardMatch = {
  match_id: string;
  match_no: number | null;
  round: number | null;
  status: DbMatch["status"];
  finalized_by_admin: boolean;
  /** Phase 8d-prep: captain/opponent verification handshake state. */
  submission_status: DbSubmissionStatus;
  /** Timestamps drive "submitted Xm ago" UI labels. */
  captain_submitted_at: string | null;
  opponent_confirmed_at: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_team_name: string;
  away_team_name: string;
  home_shots: number;
  away_shots: number;
  rink: string | null;
  /** True when the player is on the home side. False when on away.
   *  Spectator rendering is gated server-side — caller only renders
   *  the scorecard when this is non-null (i.e., player is a participant). */
  player_is_home: boolean;
  /** Tournament context — drives header chrome + scoring rules. */
  tournament: {
    id: string;
    name: string;
    format: DbTournament["format"];
    structure: DbTournament["structure"];
    handicap_rule: DbTournament["handicap_rule"];
    shots_up_target: number | null;
    ends_per_match: number | null;
    host_club_theme: DbThemePreset;
  };
  /** Team-level handicap shots (8d will surface negotiated handicap
   *  values when the engine supports them; for 8c we read the column
   *  if present and default to 0). Both 0 in the seed data. */
  home_handicap_shots: number;
  away_handicap_shots: number;
};

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

export async function getScorecardMatch(
  matchId: string,
): Promise<ScorecardMatch | null> {
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .select(
      "id, match_no, round, status, finalized_by_admin, submission_status, captain_submitted_at, opponent_confirmed_at, home_team_id, away_team_id, home_shots, away_shots, rink:rinks(number, green:greens(name)), home_team:tournament_teams!home_team_id(name, handicap_shots), away_team:tournament_teams!away_team_id(name, handicap_shots), tournament:tournaments(id, name, format, structure, handicap_rule, shots_up_target, ends_per_match, clubs!host_club_id(theme_preset))",
    )
    .eq("id", matchId)
    .maybeSingle();

  if (error) {
    console.error("[getScorecardMatch] query failed:", error);
    return null;
  }
  if (!data) return null;

  const teamIds = await teamIdsForCurrentPlayer();
  const playerIsHome =
    data.home_team_id != null && teamIds.includes(data.home_team_id);
  const playerIsAway =
    data.away_team_id != null && teamIds.includes(data.away_team_id);
  if (!playerIsHome && !playerIsAway) {
    // Spectator — scorecard is participant-only. Redirect handled by
    // the page itself.
    return null;
  }

  const homeTeam = data.home_team as
    | { name?: string; handicap_shots?: number }
    | null;
  const awayTeam = data.away_team as
    | { name?: string; handicap_shots?: number }
    | null;
  const tournament = data.tournament as {
    id: string;
    name: string;
    format: DbTournament["format"];
    structure: DbTournament["structure"];
    handicap_rule: DbTournament["handicap_rule"];
    shots_up_target: number | null;
    ends_per_match: number | null;
    clubs: { theme_preset: DbThemePreset } | null;
  } | null;
  return {
    match_id: data.id,
    match_no: data.match_no,
    round: data.round,
    status: data.status,
    finalized_by_admin: data.finalized_by_admin,
    submission_status: data.submission_status,
    captain_submitted_at: data.captain_submitted_at,
    opponent_confirmed_at: data.opponent_confirmed_at,
    home_team_id: data.home_team_id,
    away_team_id: data.away_team_id,
    home_team_name: homeTeam?.name ?? "Home team",
    away_team_name: awayTeam?.name ?? "Away team",
    home_shots: data.home_shots,
    away_shots: data.away_shots,
    rink: formatRinkLabel(data.rink as RinkEmbed),
    player_is_home: playerIsHome,
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
    home_handicap_shots: homeTeam?.handicap_shots ?? 0,
    away_handicap_shots: awayTeam?.handicap_shots ?? 0,
  };
}
