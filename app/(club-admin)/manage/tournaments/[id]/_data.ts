import "server-only";

import { getAuthContext } from "@/lib/auth/role";
import { matchRowToPrimitive } from "@/lib/tournaments/adapters";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type DbTournament = Database["public"]["Tables"]["tournaments"]["Row"];
type DbEntry = Database["public"]["Tables"]["tournament_entries"]["Row"];
type DbMatch = Database["public"]["Tables"]["matches"]["Row"];
type DbTournamentTeam = Pick<
  Database["public"]["Tables"]["tournament_teams"]["Row"],
  "id" | "name" | "seed"
>;
type DbProfile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "first_name" | "last_name" | "display_name" | "bsa_number"
>;
type DbClub = Pick<
  Database["public"]["Tables"]["clubs"]["Row"],
  "id" | "name" | "short_name" | "theme_preset"
>;

export type TournamentDetail = DbTournament & {
  host_club: DbClub;
  entries_count: number;
  matches_total: number;
  matches_open: number;
  matches_in_progress: number;
};

export type EntryRow = {
  id: string;
  seed: number | null;
  withdrawn: boolean;
  // Display fields — derived from joins so the UI doesn't re-derive.
  display_name: string;
  bsa_number: string | null;
  club_name: string;
  club_short_name: string | null;
  // Composite paid flag — entry-level for now (no `paid` column yet on
  // the schema; see DRIFT — payment integration deferred to v2). UI
  // renders the toggle but it's display-only until that lands.
  paid_placeholder: boolean;
};

// Loads a single tournament + host club + summary counts. Returns null
// when the tournament doesn't exist OR when the caller isn't authorised
// (RLS hides it; the server-side filter is defence-in-depth).
export async function getTournamentDetail(
  tournamentId: string,
): Promise<TournamentDetail | null> {
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select(
      "*, host_club:clubs!host_club_id(id, name, short_name, theme_preset), entries:tournament_entries(count), matches:matches(count, status)",
    )
    .eq("id", tournamentId)
    .maybeSingle();

  if (error || !data) return null;

  if (
    ctx.role === "club_admin" &&
    !ctx.clubIds.includes(data.host_club_id)
  ) {
    return null;
  }

  // Supabase aggregate-with-where — `matches:matches(count, status)`
  // returns rows aggregated per status. Reshape into the counts we
  // care about; defensive against the array being a flat aggregate row.
  const matchesAgg = Array.isArray(data.matches) ? data.matches : [];
  let matchesTotal = 0;
  let matchesOpen = 0;
  let matchesInProgress = 0;
  for (const m of matchesAgg) {
    const c = Number((m as { count?: number }).count ?? 0);
    matchesTotal += c;
    const s = String((m as { status?: string }).status ?? "");
    if (s === "scheduled") matchesOpen += c;
    if (s === "in_progress") matchesInProgress += c;
  }

  const entriesAgg = Array.isArray(data.entries) ? data.entries : [];
  const entriesCount = entriesAgg.length
    ? Number((entriesAgg[0] as { count?: number }).count ?? 0)
    : 0;

  // Strip the join shapes from the parent row so the typed return shape
  // matches what callers actually consume.
  const { host_club, entries: _e, matches: _m, ...rest } = data;
  void _e;
  void _m;

  return {
    ...(rest as DbTournament),
    host_club: host_club as DbClub,
    entries_count: entriesCount,
    matches_total: matchesTotal,
    matches_open: matchesOpen,
    matches_in_progress: matchesInProgress,
  };
}

export async function getTournamentEntries(
  tournamentId: string,
): Promise<EntryRow[]> {
  const ctx = await getAuthContext();
  if (!ctx) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournament_entries")
    .select(
      "id, seed, withdrawn, profile:profiles(id, first_name, last_name, display_name, bsa_number), club:clubs!club_id(id, name, short_name)",
    )
    .eq("tournament_id", tournamentId)
    .order("seed", { ascending: true, nullsFirst: false });

  if (error || !data) return [];

  return data.map((e) => {
    const p = e.profile as DbProfile | null;
    const c = e.club as Pick<DbClub, "id" | "name" | "short_name"> | null;
    return {
      id: e.id,
      seed: e.seed,
      withdrawn: e.withdrawn,
      display_name: deriveDisplayName(p),
      bsa_number: p?.bsa_number ?? null,
      club_name: c?.name ?? "—",
      club_short_name: c?.short_name ?? null,
      paid_placeholder: false,
    };
  });
}

// -------------------- matches (Draw + Scoring tabs) --------------------

export type MatchRow = {
  id: string;
  match_no: number | null;
  round: number | null;
  rink: string | null;
  status: Database["public"]["Enums"]["match_status"];
  finalized_by_admin: boolean;
  home_team: DbTournamentTeam | null;
  away_team: DbTournamentTeam | null;
  home_shots: number;
  away_shots: number;
  winner_team_id: string | null;
  slot_a_source_type: string | null;
  slot_a_source_match_id: string | null;
  slot_b_source_type: string | null;
  slot_b_source_match_id: string | null;
};

export async function getMatchesForTournament(
  tournamentId: string,
): Promise<MatchRow[]> {
  const ctx = await getAuthContext();
  if (!ctx) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .select(
      "id, match_no, round, status, finalized_by_admin, home_shots, away_shots, winner_team_id, slot_a_source_type, slot_a_source_match_id, slot_b_source_type, slot_b_source_match_id, rink:rinks(name), home_team:tournament_teams!home_team_id(id, name, seed), away_team:tournament_teams!away_team_id(id, name, seed)",
    )
    .eq("tournament_id", tournamentId)
    .order("round", { ascending: true })
    .order("match_no", { ascending: true });

  if (error || !data) return [];

  return data.map((m) => {
    const rinkObj = m.rink as { name?: string | null } | null;
    return {
      id: m.id,
      match_no: m.match_no,
      round: m.round,
      rink: rinkObj?.name ?? null,
      status: m.status,
      finalized_by_admin: m.finalized_by_admin,
      home_team: (m.home_team as DbTournamentTeam | null) ?? null,
      away_team: (m.away_team as DbTournamentTeam | null) ?? null,
      home_shots: m.home_shots,
      away_shots: m.away_shots,
      winner_team_id: m.winner_team_id,
      slot_a_source_type: m.slot_a_source_type,
      slot_a_source_match_id: m.slot_a_source_match_id,
      slot_b_source_type: m.slot_b_source_type,
      slot_b_source_match_id: m.slot_b_source_match_id,
    };
  });
}

/** Pure derivation that picks the display status for the bracket — uses
 *  the existing adapter so admin / player surfaces stay in lock-step. */
export function matchToDisplayStatus(
  m: Pick<MatchRow, "status" | "finalized_by_admin">,
) {
  // Reuse the canonical primitive mapper. Returns one of the
  // `PrimitiveMatchStatus` literals which the StatusDot component
  // recognises directly.
  return matchRowToPrimitive({
    // Only the two fields the mapper needs for status synthesis.
    status: m.status,
    finalized_by_admin: m.finalized_by_admin,
    // Stub the rest — matchRowToPrimitive doesn't read them for status.
    id: "",
    home_team_id: null,
    away_team_id: null,
    home_shots: 0,
    away_shots: 0,
    home_ends_won: 0,
    away_ends_won: 0,
    bracket_slot: null,
    rink_id: null,
    round: null,
    section_label: null,
    starts_at: null,
    ends_at: null,
    notes: null,
    tournament_id: "",
    winner_team_id: null,
    slot_a_source_match_id: null,
    slot_a_source_type: null,
    slot_b_source_match_id: null,
    slot_b_source_type: null,
    match_no: null,
    created_at: "",
    updated_at: "",
  } as Database["public"]["Tables"]["matches"]["Row"]).status;
}

function deriveDisplayName(p: DbProfile | null): string {
  if (!p) return "Unknown";
  if (p.display_name) return p.display_name;
  const parts = [p.first_name, p.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : "Unknown";
}
