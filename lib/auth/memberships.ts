import "server-only";

import { cache } from "react";

import { getAuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type ClubThemePreset = Database["public"]["Enums"]["club_theme_preset"];
type PlayerPosition = Database["public"]["Enums"]["player_position"];
type MembershipStatus = Database["public"]["Enums"]["membership_status"];

export type MembershipWithClub = {
  membership_id: string;
  club_id: string;
  club_name: string;
  club_short_name: string | null;
  club_theme_preset: ClubThemePreset;
  is_primary: boolean;
  club_grading: PlayerPosition | null;
  status: MembershipStatus;
  joined_at: string;
};

// Cached per-request fetch of the caller's active club_memberships with
// embedded club info. Used by the (player) layout's ClubSwitcher and by
// /me's membership list — same DB hit, two consumers.
export const getCurrentMemberships = cache(
  async (): Promise<MembershipWithClub[]> => {
    const ctx = await getAuthContext();
    if (!ctx) return [];
    const supabase = await createClient();
    const { data } = await supabase
      .from("club_memberships")
      .select(
        "id, club_id, is_primary, club_grading, status, joined_at, club:clubs!inner(name, short_name, theme_preset)",
      )
      .eq("profile_id", ctx.userId)
      .eq("status", "active");
    if (!data) return [];
    return data.map((m) => ({
      membership_id: m.id,
      club_id: m.club_id,
      club_name: m.club.name,
      club_short_name: m.club.short_name,
      club_theme_preset: m.club.theme_preset,
      is_primary: m.is_primary,
      club_grading: m.club_grading,
      status: m.status,
      joined_at: m.joined_at,
    }));
  },
);
