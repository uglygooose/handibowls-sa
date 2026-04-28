import "server-only";

import { getAuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

// Per the user_role enum, super_admin sees every tournament; club_admin
// sees only tournaments hosted by clubs in their JWT claim. Both go
// through the same Supabase server client so RLS provides a second
// layer of defence even if this filter were ever missed.

export type TournamentStatus = Database["public"]["Enums"]["tournament_status"];
export type TournamentFormat = Database["public"]["Enums"]["tournament_format"];
export type TournamentStructure = Database["public"]["Enums"]["tournament_structure"];
export type TournamentScope = Database["public"]["Enums"]["tournament_scope"];

export type TournamentListRow = {
  id: string;
  host_club_id: string;
  name: string;
  format: TournamentFormat;
  structure: TournamentStructure;
  scope: TournamentScope;
  status: TournamentStatus;
  starts_at: string | null;
  ends_at: string | null;
  entries_close_at: string | null;
  max_entries: number | null;
  ends_per_match: number | null;
  shots_up_target: number | null;
  entries_count: number;
  created_at: string;
};

export async function getTournamentsForCurrentAdmin(): Promise<TournamentListRow[]> {
  const ctx = await getAuthContext();
  if (!ctx) return [];

  const supabase = await createClient();
  // tournament_entries(count) returns an aggregated count; we don't need
  // the row data. Per Supabase REST: foreign-table-name(count) → array of
  // { count } that we flatten in the mapper below.
  let query = supabase
    .from("tournaments")
    .select(
      "id, host_club_id, name, format, structure, scope, status, starts_at, ends_at, entries_close_at, max_entries, ends_per_match, shots_up_target, created_at, entries:tournament_entries(count)",
    )
    .order("starts_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (ctx.role === "club_admin") {
    if (ctx.clubIds.length === 0) return [];
    query = query.in("host_club_id", ctx.clubIds);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    host_club_id: row.host_club_id,
    name: row.name,
    format: row.format,
    structure: row.structure,
    scope: row.scope,
    status: row.status,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    entries_close_at: row.entries_close_at,
    max_entries: row.max_entries,
    ends_per_match: row.ends_per_match,
    shots_up_target: row.shots_up_target,
    entries_count:
      Array.isArray(row.entries) && row.entries.length > 0
        ? Number(row.entries[0].count ?? 0)
        : 0,
    created_at: row.created_at,
  }));
}
