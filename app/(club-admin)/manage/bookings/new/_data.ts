import "server-only";

import { getCurrentHostClub } from "@/lib/auth/memberships";
import { getAuthContext } from "@/lib/auth/role";
import { formatPlayerName } from "@/lib/format/profile-display";
import { createClient } from "@/lib/supabase/server";

// Phase 12 / 12-1 followup — fetchers for the admin booking-creation
// form. Two list-shaped helpers: members (for the player picker) and
// rinks (for the rink picker). Both RLS-scoped to the host club.

export type BookingFormMember = {
  profile_id: string;
  name: string;
  bsa_number: string | null;
};

export type BookingFormRink = {
  rink_id: string;
  rink_number: number;
  green_name: string;
  rink_active: boolean;
  green_active: boolean;
};

export type BookingFormData =
  | {
      ok: true;
      club_id: string;
      club_name: string;
      members: BookingFormMember[];
      rinks: BookingFormRink[];
    }
  | { ok: false; reason: "no-club" | "error"; error?: string };

export async function getBookingFormData(): Promise<BookingFormData> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, reason: "no-club" };

  const club = await getCurrentHostClub();
  if (!club) return { ok: false, reason: "no-club" };

  const supabase = await createClient();

  const [membersRes, greensRes] = await Promise.all([
    supabase
      .from("club_memberships")
      .select(
        "profile:profiles!inner(id, first_name, last_name, display_name, bsa_number)",
      )
      .eq("club_id", club.club_id)
      .eq("status", "active"),
    supabase
      .from("greens")
      .select("id, name, active, rinks(id, number, active)")
      .eq("club_id", club.club_id)
      .order("name", { ascending: true }),
  ]);

  if (membersRes.error) {
    console.error("[bookings/new] members fetch failed:", membersRes.error);
    return { ok: false, reason: "error", error: membersRes.error.message };
  }
  if (greensRes.error) {
    console.error("[bookings/new] greens fetch failed:", greensRes.error);
    return { ok: false, reason: "error", error: greensRes.error.message };
  }

  const members: BookingFormMember[] = (membersRes.data ?? [])
    .map((m) => {
      const p = m.profile as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        display_name: string | null;
        bsa_number: string | null;
      } | null;
      if (!p) return null;
      // Phase 13 / 13-2b / Batch H1: nameOf now always returns a
      // string (formatPlayerName handles the no-name fallback as
      // "Deleted player" — the canonical POPIA anonymisation
      // marker; the prior "(unnamed member)" fallback was
      // semantically distinct but the locked decision unifies on
      // "Deleted player" across cross-user surfaces).
      const name = nameOf(p);
      return {
        profile_id: p.id,
        name,
        bsa_number: p.bsa_number,
      };
    })
    .filter((x): x is BookingFormMember => x !== null)
    .sort((a, b) =>
      a.name.localeCompare(b.name, "en-ZA", { sensitivity: "base" }),
    );

  const rinks: BookingFormRink[] = (greensRes.data ?? []).flatMap((g) => {
    const greenActive = g.active === true;
    const greenRinks =
      (g.rinks as Array<{ id: string; number: number; active: boolean }> | null) ??
      [];
    return greenRinks
      .map((r) => ({
        rink_id: r.id,
        rink_number: r.number,
        green_name: g.name,
        rink_active: r.active === true,
        green_active: greenActive,
      }))
      .sort((a, b) => a.rink_number - b.rink_number);
  });

  return {
    ok: true,
    club_id: club.club_id,
    club_name: club.club_name,
    members,
    rinks,
  };
}

function nameOf(p: {
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
}): string {
  // Phase 13 / 13-2b / Batch H1 — display_name preference + formatPlayerName
  // for first/last composition + "Deleted player" anonymisation marker.
  if (p.display_name) return p.display_name;
  return formatPlayerName(p);
}
