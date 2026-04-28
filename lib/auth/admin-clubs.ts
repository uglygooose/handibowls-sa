import "server-only";

import { cache } from "react";

import { getAuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type ClubThemePreset = Database["public"]["Enums"]["club_theme_preset"];

export type AdminAssignmentWithClub = {
  assignment_id: string;
  club_id: string;
  club_name: string;
  club_short_name: string | null;
  club_theme_preset: ClubThemePreset;
  assigned_at: string;
};

// Cached per-request fetch of the caller's club_admin_assignments with embedded
// club info. The schema treats admin assignments and player memberships as
// distinct tables — assignments scope role authority, memberships scope
// player participation. The JWT hook (migration 009) UNIONs both into the
// `club_ids` claim, but Server Components that need to render or scope by
// "host club" must read the source tables explicitly because the JWT only
// carries IDs, not names or theme presets.
export const getCurrentAdminClubs = cache(
  async (): Promise<AdminAssignmentWithClub[]> => {
    const ctx = await getAuthContext();
    if (!ctx) return [];
    const supabase = await createClient();
    const { data } = await supabase
      .from("club_admin_assignments")
      .select(
        "id, club_id, assigned_at, club:clubs!inner(name, short_name, theme_preset)",
      )
      .eq("profile_id", ctx.userId)
      .order("assigned_at", { ascending: true });
    if (!data) return [];
    return data.map((a) => ({
      assignment_id: a.id,
      club_id: a.club_id,
      club_name: a.club.name,
      club_short_name: a.club.short_name,
      club_theme_preset: a.club.theme_preset,
      assigned_at: a.assigned_at,
    }));
  },
);
