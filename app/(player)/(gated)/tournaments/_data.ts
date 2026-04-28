import "server-only";

import { getAuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

// Phase 8b — player-side tournaments list. Two streams the design
// surfaces under the Available / Entered tabs:
//
//   • Available — tournaments the player can join. Status === 'open'
//     and `entries_close_at` is null OR in the future. Scoped to clubs
//     the player belongs to (RLS reads via `tournaments_member_read`)
//     plus tournaments at scope='district'/'provincial'/'national'
//     hosted by clubs in the player's district. For Phase 8b we keep
//     this strict (player's club_ids) — district/provincial discovery
//     is a Phase 12 cross-cutting item once the seed data has multiple
//     districts.
//   • Entered — tournaments where the player has a `tournament_entries`
//     row OR a `tournament_team_members` row (singles use entries;
//     team formats use team members; either entry counts).
//
// Sorted by start date ascending so the closest upcoming surfaces first.

type DbTournamentFormat = Database["public"]["Enums"]["tournament_format"];
type DbTournamentScope = Database["public"]["Enums"]["tournament_scope"];
type DbTournamentStatus = Database["public"]["Enums"]["tournament_status"];

export type PlayerTournamentRow = {
  id: string;
  name: string;
  format: DbTournamentFormat;
  scope: DbTournamentScope;
  status: DbTournamentStatus;
  starts_at: string | null;
  ends_at: string | null;
  entries_close_at: string | null;
  entries_count: number;
  max_entries: number | null;
  handicap_rule: Database["public"]["Enums"]["handicap_rule"];
  /** Always true when the row appears in `entered`; never read on `available`. */
  player_has_open_match: boolean;
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

export async function getAvailableTournamentsForPlayer(): Promise<
  PlayerTournamentRow[]
> {
  const ctx = await getAuthContext();
  if (!ctx) return [];
  if (ctx.clubIds.length === 0) return [];

  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("tournaments")
    .select(
      "id, name, format, scope, status, starts_at, ends_at, entries_close_at, max_entries, handicap_rule, host_club_id, entries:tournament_entries(count)",
    )
    .in("host_club_id", ctx.clubIds)
    .eq("status", "open")
    .or(`entries_close_at.is.null,entries_close_at.gt.${nowIso}`)
    .order("starts_at", { ascending: true, nullsFirst: false });

  return (data ?? []).map((t) => mapTournamentRow(t, false));
}

export async function getEnteredTournamentsForPlayer(): Promise<
  PlayerTournamentRow[]
> {
  const ctx = await getAuthContext();
  if (!ctx) return [];

  const supabase = await createClient();

  // Path A — singles entries: tournament_entries.profile_id = me
  const { data: entriesRows } = await supabase
    .from("tournament_entries")
    .select("tournament_id")
    .eq("profile_id", ctx.userId);
  const fromEntries = new Set(
    (entriesRows ?? []).map((r) => r.tournament_id),
  );

  // Path B — team formats: tournament_team_members → tournament_teams →
  // tournament_id. Resolve via the team_ids we already use elsewhere.
  const teamIds = await teamIdsForCurrentPlayer();
  if (teamIds.length > 0) {
    const { data: teamRows } = await supabase
      .from("tournament_teams")
      .select("tournament_id")
      .in("id", teamIds);
    for (const r of teamRows ?? []) fromEntries.add(r.tournament_id);
  }

  const tournamentIds = Array.from(fromEntries).filter(Boolean);
  if (tournamentIds.length === 0) return [];

  const { data: rows } = await supabase
    .from("tournaments")
    .select(
      "id, name, format, scope, status, starts_at, ends_at, entries_close_at, max_entries, handicap_rule, host_club_id, entries:tournament_entries(count)",
    )
    .in("id", tournamentIds)
    .order("starts_at", { ascending: true, nullsFirst: false });

  // For "entered" entries, surface whether the player has a non-completed
  // match in the tournament (fuels the "in-play" state on the card).
  const inPlayTournamentIds = await tournamentsWithOpenMatchForPlayer(
    teamIds,
    tournamentIds,
  );

  return (rows ?? []).map((t) =>
    mapTournamentRow(t, inPlayTournamentIds.has(t.id)),
  );
}

async function tournamentsWithOpenMatchForPlayer(
  teamIds: string[],
  tournamentIds: string[],
): Promise<Set<string>> {
  if (teamIds.length === 0 || tournamentIds.length === 0)
    return new Set<string>();
  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select("tournament_id")
    .in("tournament_id", tournamentIds)
    .or(`home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`)
    .in("status", ["scheduled", "in_progress"]);
  return new Set((data ?? []).map((m) => m.tournament_id));
}

function mapTournamentRow(
  // The select is deeply nested; type loosely for the mapper.
  row: {
    id: string;
    name: string;
    format: DbTournamentFormat;
    scope: DbTournamentScope;
    status: DbTournamentStatus;
    starts_at: string | null;
    ends_at: string | null;
    entries_close_at: string | null;
    max_entries: number | null;
    handicap_rule: Database["public"]["Enums"]["handicap_rule"];
    entries: Array<{ count: number }> | null;
  },
  playerHasOpenMatch: boolean,
): PlayerTournamentRow {
  const aggCount = Array.isArray(row.entries) && row.entries.length > 0
    ? Number(row.entries[0].count ?? 0)
    : 0;
  return {
    id: row.id,
    name: row.name,
    format: row.format,
    scope: row.scope,
    status: row.status,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    entries_close_at: row.entries_close_at,
    entries_count: aggCount,
    max_entries: row.max_entries,
    handicap_rule: row.handicap_rule,
    player_has_open_match: playerHasOpenMatch,
  };
}
