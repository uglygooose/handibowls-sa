import "server-only";

import { getAuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

// Phase 8b — player-side read-only tournament detail. RLS-scoped via
// `tournaments_member_read` (player can read tournaments at clubs they
// belong to OR tournaments they participate in). Server-side filter is
// defence-in-depth — the JS guard checks the JWT club_ids claim
// matches the host club.

type DbTournamentFormat = Database["public"]["Enums"]["tournament_format"];
type DbTournamentScope = Database["public"]["Enums"]["tournament_scope"];
type DbTournamentStatus = Database["public"]["Enums"]["tournament_status"];
type DbTournamentStructure = Database["public"]["Enums"]["tournament_structure"];
type DbHandicapRule = Database["public"]["Enums"]["handicap_rule"];
type DbMatchStatus = Database["public"]["Enums"]["match_status"];
type DbThemePreset = Database["public"]["Enums"]["club_theme_preset"];

export type PlayerTournamentDetail = {
  id: string;
  name: string;
  format: DbTournamentFormat;
  structure: DbTournamentStructure;
  scope: DbTournamentScope;
  status: DbTournamentStatus;
  handicap_rule: DbHandicapRule;
  shots_up_target: number | null;
  ends_per_match: number | null;
  starts_at: string | null;
  ends_at: string | null;
  entries_close_at: string | null;
  entries_count: number;
  max_entries: number | null;
  host_club_id: string;
  host_club_name: string;
  host_club_theme: DbThemePreset;
  district_name: string | null;
  greens_count: number;
};

export type PlayerMatchRow = {
  id: string;
  match_no: number | null;
  round: number | null;
  status: DbMatchStatus;
  finalized_by_admin: boolean;
  home_shots: number;
  away_shots: number;
  home_team_name: string | null;
  away_team_name: string | null;
  /** True when the current player is in either team for this match. */
  player_is_in: boolean;
  player_is_home: boolean;
  /** Computed display status — derived from match status + finalized
   *  flag. Player UI uses this to render the OPEN / IN_PLAY / FINAL /
   *  BYE pill family from the design source. */
  display_status: "OPEN" | "IN_PLAY" | "FINAL" | "BYE";
};

export type PlayerRoundGroup = {
  round: number;
  label: string;
  matches: PlayerMatchRow[];
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

export async function getTournamentDetailForPlayer(
  tournamentId: string,
): Promise<PlayerTournamentDetail | null> {
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select(
      "id, name, format, structure, scope, status, handicap_rule, shots_up_target, ends_per_match, starts_at, ends_at, entries_close_at, max_entries, host_club_id, host_club:clubs!host_club_id(name, theme_preset, district:districts(name)), entries:tournament_entries(count)",
    )
    .eq("id", tournamentId)
    .maybeSingle();

  if (error) {
    console.error("[getTournamentDetailForPlayer] query failed:", error);
    return null;
  }
  if (!data) return null;

  // Greens count via a separate scoped query — greens are FK'd to clubs,
  // not tournaments, so the parent embed can't carry it. Light follow-up
  // query keeps the parent select shape correct (avoids the Phase 7
  // multi-projection embed bug pattern).
  const { count: greensCount } = await supabase
    .from("greens")
    .select("*", { count: "exact", head: true })
    .eq("club_id", data.host_club_id)
    .eq("active", true);

  const club = data.host_club as
    | {
        name?: string;
        theme_preset?: DbThemePreset;
        district?: { name?: string } | null;
      }
    | null;
  const entriesAgg = Array.isArray(data.entries) ? data.entries : [];

  return {
    id: data.id,
    name: data.name,
    format: data.format,
    structure: data.structure,
    scope: data.scope,
    status: data.status,
    handicap_rule: data.handicap_rule,
    shots_up_target: data.shots_up_target,
    ends_per_match: data.ends_per_match,
    starts_at: data.starts_at,
    ends_at: data.ends_at,
    entries_close_at: data.entries_close_at,
    entries_count: entriesAgg.length
      ? Number((entriesAgg[0] as { count?: number }).count ?? 0)
      : 0,
    max_entries: data.max_entries,
    host_club_id: data.host_club_id,
    host_club_name: club?.name ?? "Unknown club",
    host_club_theme: club?.theme_preset ?? "ocean-green",
    district_name: club?.district?.name ?? null,
    greens_count: greensCount ?? 0,
  };
}

export async function getMatchesGroupedByRoundForPlayer(
  tournamentId: string,
): Promise<PlayerRoundGroup[]> {
  const ctx = await getAuthContext();
  if (!ctx) return [];
  const teamIds = await teamIdsForCurrentPlayer();

  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select(
      "id, match_no, round, status, finalized_by_admin, home_shots, away_shots, home_team_id, away_team_id, home_team:tournament_teams!home_team_id(name), away_team:tournament_teams!away_team_id(name)",
    )
    .eq("tournament_id", tournamentId)
    .order("round", { ascending: true })
    .order("match_no", { ascending: true });

  if (!data) return [];

  // Bucket by round; preserve insertion order for round labels.
  const groups = new Map<number, PlayerRoundGroup>();
  for (const m of data) {
    const round = m.round ?? 0;
    const homeTeam = m.home_team as { name?: string } | null;
    const awayTeam = m.away_team as { name?: string } | null;
    const playerIsHome =
      m.home_team_id != null && teamIds.includes(m.home_team_id);
    const playerIsAway =
      m.away_team_id != null && teamIds.includes(m.away_team_id);
    const playerIsIn = playerIsHome || playerIsAway;

    let displayStatus: PlayerMatchRow["display_status"] = "OPEN";
    if (m.home_team_id == null || m.away_team_id == null) displayStatus = "BYE";
    else if (m.status === "completed" || m.finalized_by_admin)
      displayStatus = "FINAL";
    else if (m.status === "in_progress") displayStatus = "IN_PLAY";
    else displayStatus = "OPEN";

    const row: PlayerMatchRow = {
      id: m.id,
      match_no: m.match_no,
      round: m.round,
      status: m.status,
      finalized_by_admin: m.finalized_by_admin,
      home_shots: m.home_shots,
      away_shots: m.away_shots,
      home_team_name: homeTeam?.name ?? null,
      away_team_name: awayTeam?.name ?? null,
      player_is_in: playerIsIn,
      player_is_home: playerIsHome,
      display_status: displayStatus,
    };
    if (!groups.has(round)) {
      groups.set(round, {
        round,
        label: roundLabelFor(round, data),
        matches: [],
      });
    }
    groups.get(round)!.matches.push(row);
  }
  return Array.from(groups.values()).sort((a, b) => a.round - b.round);
}

// Round label lookup — knockout: "Round N" everywhere except the final
// (largest round number) which gets "Final" and the penultimate which
// gets "Semis". This is heuristic — safe for power-of-2 KO and
// degrades to "Round N" for irregular sizes.
function roundLabelFor(
  round: number,
  allMatches: Array<{ round: number | null }>,
): string {
  if (round === 0) return "Pre-round";
  const roundsPresent = new Set(
    allMatches.map((m) => m.round ?? 0).filter((r) => r > 0),
  );
  const maxRound = Math.max(...Array.from(roundsPresent), round);
  if (round === maxRound) return "Final";
  if (round === maxRound - 1) return "Semis";
  if (round === maxRound - 2) return `Round ${round} — QF`;
  return `Round ${round}`;
}

// Player's earliest non-completed match in this tournament. Drives the
// "Score next match" CTA in the detail hero + the inline notice block.
//
// Phase 8d Finding 17 — filter on submission_status='pending'. The hero
// CTA + inline notice are scoreability cues; once the captain has
// submitted (submission_status='captain_submitted') the match is
// awaiting the opponent and isn't actionable here. Bracket pills stay
// IN_PLAY for the same row per design (4-state enum).
export async function getPlayerOpenMatchInTournament(
  tournamentId: string,
): Promise<PlayerMatchRow | null> {
  const teamIds = await teamIdsForCurrentPlayer();
  if (teamIds.length === 0) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select(
      "id, match_no, round, status, finalized_by_admin, home_shots, away_shots, home_team_id, away_team_id, home_team:tournament_teams!home_team_id(name), away_team:tournament_teams!away_team_id(name)",
    )
    .eq("tournament_id", tournamentId)
    .or(
      `home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`,
    )
    .in("status", ["scheduled", "in_progress"])
    .eq("submission_status", "pending")
    .order("starts_at", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const homeTeam = data.home_team as { name?: string } | null;
  const awayTeam = data.away_team as { name?: string } | null;
  const playerIsHome =
    data.home_team_id != null && teamIds.includes(data.home_team_id);

  const displayStatus: PlayerMatchRow["display_status"] =
    data.status === "in_progress" ? "IN_PLAY" : "OPEN";

  return {
    id: data.id,
    match_no: data.match_no,
    round: data.round,
    status: data.status,
    finalized_by_admin: data.finalized_by_admin,
    home_shots: data.home_shots,
    away_shots: data.away_shots,
    home_team_name: homeTeam?.name ?? null,
    away_team_name: awayTeam?.name ?? null,
    player_is_in: true,
    player_is_home: playerIsHome,
    display_status: displayStatus,
  };
}
