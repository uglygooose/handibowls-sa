import "server-only";

import { cache } from "react";

import { getCurrentAdminClubs } from "@/lib/auth/admin-clubs";
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

export type HostClub = {
  club_id: string;
  club_name: string;
  club_short_name: string | null;
  club_theme_preset: ClubThemePreset;
  /** Which table the resolution came from. Useful for layered audit and for
   *  callers that need different chrome based on whether the user owns the
   *  club (admin_assignment) vs plays at it (membership). */
  source: "admin_assignment" | "membership";
};

// Role-aware "what club is the current user managing/playing at right now?"
// resolver. Phase 7 needed this because admin-scoped layouts (foot card
// identity, hero subtitle, /new form scoping) all want a single host-club
// abstraction that doesn't care which underlying table answered.
//
//   - club_admin → first club_admin_assignment (ordered by assigned_at).
//                  The rare multi-club admin gets the oldest assignment;
//                  Phase-12 polish will surface a picker.
//   - super_admin → null. Super admins don't have a canonical host club.
//                   Platform-wide pages don't need one; club-scoped pages
//                   visited by super_admins should resolve via URL params
//                   (e.g. /platform/clubs/[id]) or fall back to a picker
//                   landing in Phase-12 polish. Returning null here keeps
//                   the contract honest rather than silently scoping to a
//                   stray membership.
//   - player (and JWT-fallback "player") → primary active membership,
//                  falling back to the first active membership when none
//                  is flagged primary.
export const getCurrentHostClub = cache(async (): Promise<HostClub | null> => {
  const ctx = await getAuthContext();
  if (!ctx) return null;

  if (ctx.role === "club_admin") {
    const assignments = await getCurrentAdminClubs();
    const first = assignments[0];
    if (!first) return null;
    return {
      club_id: first.club_id,
      club_name: first.club_name,
      club_short_name: first.club_short_name,
      club_theme_preset: first.club_theme_preset,
      source: "admin_assignment",
    };
  }

  if (ctx.role === "super_admin") return null;

  const memberships = await getCurrentMemberships();
  const primary =
    memberships.find((m) => m.is_primary) ?? memberships[0] ?? null;
  if (!primary) return null;
  return {
    club_id: primary.club_id,
    club_name: primary.club_name,
    club_short_name: primary.club_short_name,
    club_theme_preset: primary.club_theme_preset,
    source: "membership",
  };
});
