import "server-only";

import { getCurrentHostClub } from "@/lib/auth/memberships";
import { createClient } from "@/lib/supabase/server";

import {
  buildDateStrip,
  buildSlotShells,
  dateIsClosed,
  rangesOverlap,
  todayIsoSAST,
  type BookingInSlot,
  type BookingPageData,
  type BookingRink,
  type BookingSlot,
} from "./slots";

// Phase 8e-1 / 8e-2 — `/book` server-only data layer.
//
// Single fetcher consumed by the page Server Component. Types + the
// pure date-math + label helpers live in `./slots` (no server-only
// directive) so Client Components (SlotList, BookingSheet) can
// import them without poisoning the build via Next's
// server-only-in-client check. This file is server-side only — the
// auth resolution (`getCurrentHostClub` reads `auth.uid()` via the
// cookie-bound supabase client) and the DB queries.
//
// Slot derivation
//
//   The slot grid for a given date is the cross-product of:
//
//     • static 2-hour blocks 08-10, 10-12, 12-14, 14-16, 16-18 (SAST)
//     • the club's active rinks
//     • bookings overlapping each block (status='booked')
//
//   PostgREST doesn't expose tstzrange operators directly, so we
//   filter bookings to the day window via `starts_at < dayEnd AND
//   ends_at > dayStart` and run the per-slot overlap check in JS.
//   The day window is bounded so rowcount stays small.

export async function getBookingDataForCurrentPlayer(
  selectedDate: string,
): Promise<BookingPageData | null> {
  const club = await getCurrentHostClub();
  if (!club) return null;

  const supabase = await createClient();
  const todayIso = todayIsoSAST();
  const strip = buildDateStrip(todayIso, selectedDate);

  // Closure windows for the player's club — only is_closure=true rows
  // matter; the date strip starts fully open and closure overrides.
  const { data: closureRows } = await supabase
    .from("booking_windows")
    .select("weekday, starts_date, ends_date")
    .eq("club_id", club.club_id)
    .eq("is_closure", true);

  const closures = closureRows ?? [];
  for (const d of strip) {
    d.closed = dateIsClosed(d.iso, closures);
  }

  // Slot shells for the selected date.
  const shells = buildSlotShells(selectedDate);
  if (shells.length === 0) {
    return {
      club_id: club.club_id,
      club_name: club.club_name,
      bookingDates: strip,
      slotsForDate: [],
      allRinksCount: 0,
    };
  }

  const dayStart = shells[0]!.starts_at;
  const dayEnd = shells[shells.length - 1]!.ends_at;

  // All active rinks at the club, with green name for the label.
  const { data: rinkRows } = await supabase
    .from("rinks")
    .select("id, number, green:greens!inner(name, club_id)")
    .eq("active", true);
  const allRinks: Array<BookingRink & { greenName: string }> = (rinkRows ?? [])
    .filter((r) => {
      const g = r.green as { club_id?: string } | null;
      return g?.club_id === club.club_id;
    })
    .map((r) => {
      const g = r.green as { name?: string } | null;
      const greenName = g?.name ?? "Green";
      return {
        id: r.id,
        greenName,
        label: `${greenName} ${r.number}`,
      };
    });

  // All booked bookings for the day window. Filter slot-by-slot in JS
  // — overlap is range-on-range and PostgREST doesn't expose tstzrange
  // operators directly. The day window is bounded so rowcount stays
  // small (≤ rinks × slots).
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, rink_id, purpose, starts_at, ends_at")
    .eq("club_id", club.club_id)
    .eq("status", "booked")
    .lt("starts_at", dayEnd)
    .gt("ends_at", dayStart);

  const slotsForDate: BookingSlot[] = shells.map((s) => {
    const overlapping = (bookings ?? []).filter((b) =>
      rangesOverlap(s.starts_at, s.ends_at, b.starts_at, b.ends_at),
    );
    const bookedRinkIds = new Set(overlapping.map((b) => b.rink_id));
    const availableRinks = allRinks
      .filter((r) => !bookedRinkIds.has(r.id))
      .map(({ id, label }) => ({ id, label }));
    const bookingsInSlot: BookingInSlot[] = overlapping.map((b) => {
      const rink = allRinks.find((r) => r.id === b.rink_id);
      return {
        id: b.id,
        rink_label: rink?.label ?? "Rink",
        purpose: b.purpose,
      };
    });
    return {
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      starts_label: s.starts_label,
      ends_label: s.ends_label,
      available_rinks: availableRinks,
      bookings_in_slot: bookingsInSlot,
    };
  });

  return {
    club_id: club.club_id,
    club_name: club.club_name,
    bookingDates: strip,
    slotsForDate,
    allRinksCount: allRinks.length,
  };
}
