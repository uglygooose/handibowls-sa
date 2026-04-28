import "server-only";

import { getAuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";

// Phase 8a — /me data fetchers. Profile + memberships come from the
// shared lib/auth helpers (already cached per-request via React.cache);
// this file owns the page-specific extras: player stats + the inbox
// preview rows.

export type PlayerStats = {
  /** Completed matches the player participated in. */
  matches_played: number;
  /** Win-rate as a 0-100 integer. Null when matches_played === 0 (no
   *  meaningful denominator yet — surface renders "—"). */
  win_rate: number | null;
  /** Active club memberships count. Sourced from `club_memberships`. */
  club_count: number;
};

export type InboxPreviewRow = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  read: boolean;
  /** Loose category — the inbox UI maps to icons in the design source. */
  kind: string;
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

export async function getPlayerStats(): Promise<PlayerStats> {
  const ctx = await getAuthContext();
  const empty: PlayerStats = {
    matches_played: 0,
    win_rate: null,
    club_count: 0,
  };
  if (!ctx) return empty;

  const supabase = await createClient();

  // Memberships — count active rows. RLS lets the player read their own.
  const { count: clubCount } = await supabase
    .from("club_memberships")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", ctx.userId)
    .eq("status", "active");

  const teamIds = await teamIdsForCurrentPlayer();
  if (teamIds.length === 0) {
    return { ...empty, club_count: clubCount ?? 0 };
  }

  // Pull the small set of completed matches the player was in. Then
  // compute wins client-side rather than tossing the heuristic into a
  // query — it's a one-shot lookup per render and avoids a DB function.
  const { data: matches } = await supabase
    .from("matches")
    .select("home_team_id, away_team_id, home_shots, away_shots")
    .or(
      `home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`,
    )
    .eq("status", "completed");

  const played = matches?.length ?? 0;
  let wins = 0;
  for (const m of matches ?? []) {
    const playerIsHome = teamIds.includes(m.home_team_id ?? "");
    const playerShots = playerIsHome ? m.home_shots : m.away_shots;
    const opponentShots = playerIsHome ? m.away_shots : m.home_shots;
    if (playerShots > opponentShots) wins += 1;
  }

  return {
    matches_played: played,
    win_rate: played > 0 ? Math.round((wins / played) * 100) : null,
    club_count: clubCount ?? 0,
  };
}

export async function getInboxPreview(limit = 3): Promise<InboxPreviewRow[]> {
  const ctx = await getAuthContext();
  if (!ctx) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, read, created_at")
    .eq("profile_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!data) return [];
  return data.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    created_at: n.created_at,
    read: n.read,
    kind: n.kind,
  }));
}
