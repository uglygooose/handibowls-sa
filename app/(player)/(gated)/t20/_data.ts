import "server-only";

import { cache } from "react";

import { getCurrentMemberships } from "@/lib/auth/memberships";
import { getAuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

// Phase 12 / 12-1 — Player-side Twenty 20 hub data layer.
//
// Single fetcher: getCurrentPlayerT20Profile() reads the current
// player's submitted t20_assessments rows (newest first), with the
// host-club name + theme preset embed for the hero band, and returns
// { latest, history, primary_club_theme }.
//
// Cached per-request (React.cache) so the page can call it from the
// page body without forcing duplicate roundtrips when add a stats
// block / breadcrumb / etc. later.

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
  /** Past submitted assessments excluding `latest`, newest first. */
  history: PlayerT20Assessment[];
  /** Theme preset for the hero band. Falls back to the player's primary
   *  club preset when there is no assessment yet, and to "atomic-red"
   *  when the player has no club memberships. */
  primary_club_theme: DbThemePreset;
};

export const getCurrentPlayerT20Profile = cache(
  async (): Promise<PlayerT20Profile> => {
    const ctx = await getAuthContext();
    if (!ctx) {
      return { latest: null, history: [], primary_club_theme: "atomic-red" };
    }

    const memberships = await getCurrentMemberships();
    const primary =
      memberships.find((m) => m.is_primary) ?? memberships[0] ?? null;
    const primary_club_theme: DbThemePreset =
      primary?.club_theme_preset ?? "atomic-red";

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
      history: rows.slice(1),
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
): string | null {
  if (!p) return null;
  if (p.display_name) return p.display_name;
  const composed = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return composed || null;
}
