import "server-only";

import { cache } from "react";

import { getCurrentMemberships } from "@/lib/auth/memberships";
import { getAuthContext } from "@/lib/auth/role";
import { formatPlayerName } from "@/lib/format/profile-display";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

// Phase 12 / 12-1 — Player-side Twenty 20 hub data layer.
//
// Two fetchers, both cached per-request via React.cache:
//
//   getCurrentPlayerT20Profile()
//     Reads the player's submitted t20_assessments rows (newest first)
//     with host-club embed for the hero band → { latest, history,
//     primary_club_theme }.
//
//   getUpcomingT20Assessments()           [12-1 followup]
//     Reads booked rows from `bookings` filtered by
//     for_profile_id = current player + purpose = 't20_assessment' +
//     ends_at > now(). Fans out the rink + green + booker (admin)
//     embeds the upcoming-assessments cards need.

type DbT20Grade = Database["public"]["Enums"]["t20_grade"];
type DbThemePreset = Database["public"]["Enums"]["club_theme_preset"];

export type PlayerT20Assessment = {
  id: string;
  club_id: string;
  club_name: string | null;
  club_theme: DbThemePreset | null;
  assessed_on: string;
  percentage: number;
  total_score: number;
  grade: DbT20Grade | null;
  rubric_version_label: string | null;
  assessor_name: string | null;
};

export type PlayerT20Profile = {
  /** Most-recent submitted assessment for the current player, across
   *  every club they are a member of. Null when they have never been
   *  assessed (or every assessment is still in_progress / archived). */
  latest: PlayerT20Assessment | null;
  /** All submitted assessments, newest first. Includes the row that is
   *  also surfaced in `latest` — the hero is the visual focal point,
   *  the list is the tap target into the per-assessment detail view at
   *  `/t20/[assessmentId]` (12.5-4). Pre-12.5-4-hotfix this excluded
   *  the latest via rows.slice(1), which made the detail view
   *  unreachable for players with exactly 1 submitted assessment. */
  history: PlayerT20Assessment[];
  /** Theme preset for the hero band. Falls back to the player's primary
   *  club preset when there is no assessment yet, and to "ocean-green"
   *  (Henselite partnership default) when the player has no club
   *  memberships. */
  primary_club_theme: DbThemePreset;
};

export const getCurrentPlayerT20Profile = cache(
  async (): Promise<PlayerT20Profile> => {
    const ctx = await getAuthContext();
    if (!ctx) {
      return { latest: null, history: [], primary_club_theme: "ocean-green" };
    }

    const memberships = await getCurrentMemberships();
    const primary =
      memberships.find((m) => m.is_primary) ?? memberships[0] ?? null;
    const primary_club_theme: DbThemePreset =
      primary?.club_theme_preset ?? "ocean-green";

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("t20_assessments")
      .select(
        "id, club_id, assessed_on, percentage, total_score, grade, club:clubs!club_id(name, theme_preset), assessor:profiles!assessor_id(first_name, last_name, display_name), rubric:t20_rubric_versions!rubric_version_id(version)",
      )
      .eq("profile_id", ctx.userId)
      .eq("status", "submitted")
      .order("assessed_on", { ascending: false });

    if (error) {
      console.error("[t20-player] assessments fetch failed:", error);
      return { latest: null, history: [], primary_club_theme };
    }

    const rows: PlayerT20Assessment[] = (data ?? []).map((r) => {
      const club = r.club as
        | { name?: string | null; theme_preset?: DbThemePreset | null }
        | null;
      const assessor = r.assessor as
        | {
            first_name?: string | null;
            last_name?: string | null;
            display_name?: string | null;
          }
        | null;
      const rubric = r.rubric as { version?: string | null } | null;
      return {
        id: r.id,
        club_id: r.club_id,
        club_name: club?.name ?? null,
        club_theme: club?.theme_preset ?? null,
        assessed_on: r.assessed_on,
        percentage: Number(r.percentage),
        total_score: Number(r.total_score),
        grade: r.grade,
        rubric_version_label: rubric?.version ?? null,
        assessor_name: nameOf(assessor),
      };
    });

    return {
      latest: rows[0] ?? null,
      history: rows,
      primary_club_theme,
    };
  },
);

function nameOf(
  p: {
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
  } | null,
): string {
  // Phase 13 / 13-2b / Batch H1 — display_name preference + formatPlayerName
  // for first/last composition + "Deleted player" anonymisation marker.
  if (p?.display_name) return p.display_name;
  return formatPlayerName(p ?? null);
}

// ---------------------------------------------------------------------
// Upcoming assessments (12-1 followup)
// ---------------------------------------------------------------------

export type UpcomingT20Assessment = {
  id: string;
  club_id: string;
  club_name: string | null;
  green_name: string | null;
  rink_number: number | null;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  scheduler_name: string | null;
};

export const getUpcomingT20Assessments = cache(
  async (): Promise<UpcomingT20Assessment[]> => {
    const ctx = await getAuthContext();
    if (!ctx) return [];

    const supabase = await createClient();
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id, club_id, starts_at, ends_at, notes, club:clubs!club_id(name), rink:rinks!inner(number, green:greens!inner(name)), scheduler:profiles!booked_by(first_name, last_name, display_name)",
      )
      .eq("for_profile_id", ctx.userId)
      .eq("purpose", "t20_assessment")
      .eq("status", "booked")
      .gt("ends_at", nowIso)
      .order("starts_at", { ascending: true });

    if (error) {
      console.error("[t20-player] upcoming assessments fetch failed:", error);
      return [];
    }

    return (data ?? []).map((r) => {
      const club = r.club as { name?: string | null } | null;
      const rink = r.rink as
        | {
            number?: number | null;
            green?: { name?: string | null } | null;
          }
        | null;
      const scheduler = r.scheduler as
        | {
            first_name?: string | null;
            last_name?: string | null;
            display_name?: string | null;
          }
        | null;
      return {
        id: r.id,
        club_id: r.club_id,
        club_name: club?.name ?? null,
        green_name: rink?.green?.name ?? null,
        rink_number: rink?.number ?? null,
        starts_at: r.starts_at,
        ends_at: r.ends_at,
        notes: r.notes ?? null,
        scheduler_name: nameOf(scheduler),
      };
    });
  },
);
