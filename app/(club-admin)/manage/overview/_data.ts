import "server-only";

import { getAuthContext } from "@/lib/auth/role";
import { getCurrentHostClub } from "@/lib/auth/memberships";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

import { weekBoundsUtc } from "./week";

// Phase 9-2 — `/manage/overview` Bookings tab data layer.
//
// One fetcher: `getBookingsForWeek(mondayIso)`. Returns every booking
// (regardless of status) that overlaps the SAST Monday→Sunday week
// at the player's club. Cancelled rows are intentionally INCLUDED —
// the calendar visually distinguishes them, and admin ops sometimes
// want to see "what was originally booked vs cancelled".
//
// Booker name resolved via `profiles!booked_by` embed; null when
// the FK was nulled by a profile delete (`ON DELETE SET NULL` per
// migration 005).
//
// Per migration 010 RLS: club_admin reads bookings at clubs they
// admin; super_admin reads everything. The fetcher relies on the
// existing `bookings_member_read` + `bookings_club_admin_rw`
// policies for scope; we additionally filter by club_id at query
// time to keep the result narrow.

type DbBookingPurpose = Database["public"]["Enums"]["booking_purpose"];
type DbBookingStatus = Database["public"]["Enums"]["booking_status"];

export type BookingCalendarRow = {
  id: string;
  rink_id: string;
  rink_label: string;
  starts_at: string;
  ends_at: string;
  purpose: DbBookingPurpose;
  party_size: number | null;
  status: DbBookingStatus;
  notes: string | null;
  booker_name: string | null;
  booker_email: string | null;
};

export type OverviewData =
  | {
      ok: true;
      clubId: string;
      clubName: string;
      mondayIso: string;
      bookings: BookingCalendarRow[];
    }
  | { ok: false; reason: "no-club" };

export async function getBookingsForWeek(
  mondayIso: string,
): Promise<OverviewData> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, reason: "no-club" };

  const club = await getCurrentHostClub();
  if (!club) return { ok: false, reason: "no-club" };

  const supabase = await createClient();
  const { startUtc, endUtc } = weekBoundsUtc(mondayIso);

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, rink_id, starts_at, ends_at, purpose, party_size, status, notes, booker:profiles!booked_by(first_name, last_name, display_name, email), rink:rinks!inner(number, green:greens!inner(name))",
    )
    .eq("club_id", club.club_id)
    .gte("starts_at", startUtc)
    .lt("starts_at", endUtc)
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("[overview] bookings fetch failed:", error);
    return {
      ok: true,
      clubId: club.club_id,
      clubName: club.club_name,
      mondayIso,
      bookings: [],
    };
  }

  const bookings: BookingCalendarRow[] = (data ?? []).map((b) => {
    const rink = b.rink as
      | { number?: number; green?: { name?: string } | null }
      | null;
    const greenName = rink?.green?.name ?? "Green";
    const rinkLabel = `${greenName} ${rink?.number ?? "?"}`;
    const booker = b.booker as
      | {
          first_name?: string | null;
          last_name?: string | null;
          display_name?: string | null;
          email?: string | null;
        }
      | null;
    return {
      id: b.id,
      rink_id: b.rink_id,
      rink_label: rinkLabel,
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      purpose: b.purpose,
      party_size: b.party_size,
      status: b.status,
      notes: b.notes,
      booker_name: bookerName(booker),
      booker_email: booker?.email ?? null,
    };
  });

  return {
    ok: true,
    clubId: club.club_id,
    clubName: club.club_name,
    mondayIso,
    bookings,
  };
}

function bookerName(
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
