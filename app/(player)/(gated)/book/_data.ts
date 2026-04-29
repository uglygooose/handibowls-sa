import "server-only";

import { getCurrentHostClub } from "@/lib/auth/memberships";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

// Phase 8e-1 — `/book` data layer.
//
// Single fetcher consumed by the page Server Component. Returns
// the 14-day strip (today + 13 forward, Africa/Johannesburg-anchored)
// plus the per-slot grid for the selected date.
//
// Slots are derived in-process — the design source pins five
// 2-hour blocks (08-10, 10-12, 12-14, 14-16, 16-18). Each slot's
// `available_rinks` is computed by subtracting any rinks already
// booked (status='booked') for an overlapping range from the club's
// full active-rink set. Bookings list (`bookings_in_slot`) carries
// the purpose label so the design's "BOOKED · <label>" rendering
// matches.
//
// MyBookings is deliberately NOT in scope here — Phase 8e-3 ships
// the shared component for `/book` inline + `/me` full list, with
// the cancel action wired to the migration-030 RPC. 8e-1 is
// read-only.
//
// SAST anchoring
//
// Booking slots are LOCAL South African time (Africa/Johannesburg,
// static UTC+2, no DST). We construct slot timestamps with an
// explicit `+02:00` offset rather than `Intl` round-tripping — the
// offset is constitutionally fixed, and constructing
// `2026-04-29T08:00:00+02:00` is exact + readable in logs.

type DbBookingPurpose = Database["public"]["Enums"]["booking_purpose"];

export type BookingDate = {
  /** ISO date `YYYY-MM-DD` in Africa/Johannesburg. */
  iso: string;
  /** Three-letter day-of-week, uppercase (`MON`, `TUE`, …). */
  dow: string;
  /** Day-of-month numeric label (`29`). */
  day: string;
  /** True when no rinks are bookable on this date — driven by
   *  `booking_windows.is_closure = true` matching the date. */
  closed: boolean;
  /** True when the date equals today (SAST). */
  is_today: boolean;
  /** True when the date matches the page's `?d=` selection. */
  is_selected: boolean;
};

export type BookingSlot = {
  /** UTC ISO with offset for the slot start (e.g. `2026-04-29T06:00:00.000Z`). */
  starts_at: string;
  /** Same shape, slot end. */
  ends_at: string;
  /** SAST clock label, 24-hour (`08:00`). */
  starts_label: string;
  /** Same shape (`10:00`). */
  ends_label: string;
  /** Rinks not yet booked for any range overlapping this slot. */
  available_rinks: BookingRink[];
  /** Bookings overlapping this slot — used by the SlotList to render
   *  "BOOKED · <purpose>" when no rinks remain available. Empty
   *  array when the slot is fully open. */
  bookings_in_slot: BookingInSlot[];
};

export type BookingRink = {
  id: string;
  /** "Main 3" — green name + rink number per `formatRinkLabel`. */
  label: string;
};

export type BookingInSlot = {
  id: string;
  rink_label: string;
  purpose: DbBookingPurpose;
};

export type BookingPageData = {
  club_id: string;
  club_name: string;
  bookingDates: BookingDate[];
  slotsForDate: BookingSlot[];
};

// SAST is constitutionally UTC+2 with no DST. Hardcoding the offset
// avoids a round-trip through Intl + `Date.parse` inconsistencies.
const SAST_OFFSET = "+02:00";
const SAST_TZ = "Africa/Johannesburg";
const DAY_WINDOW = 14;
const SLOT_HOURS: Array<[number, number]> = [
  [8, 10],
  [10, 12],
  [12, 14],
  [14, 16],
  [16, 18],
];

const DOW_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

/** Returns today's date in Africa/Johannesburg as `YYYY-MM-DD`. */
export function todayIsoSAST(now: Date = new Date()): string {
  // `en-CA` → `2026-04-29`. Other locales pivot day/month order.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SAST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Validates a `?d=` URL param. Falls back to today (SAST) on
 *  malformed input — defensive: the URL param is user-controlled and
 *  the page must always render. JS `Date` silently rolls overflow
 *  dates (`2026-02-30` → `2026-03-02`), so we round-trip back to
 *  ISO-in-SAST and compare against the input to reject calendar
 *  impossibilities. */
export function parseDateParam(
  input: string | undefined,
  now: Date = new Date(),
): string {
  if (!input) return todayIsoSAST(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return todayIsoSAST(now);
  const parsed = new Date(`${input}T00:00:00${SAST_OFFSET}`);
  if (!Number.isFinite(parsed.getTime())) return todayIsoSAST(now);
  return isoDateInSAST(parsed) === input ? input : todayIsoSAST(now);
}

/** Builds the 14-day strip starting at `todayIso`. Pure utility —
 *  no DB access. Closed-day flagging is layered on by the data
 *  fetcher once `booking_windows` rows are known. */
export function buildDateStrip(
  todayIso: string,
  selectedIso: string,
): BookingDate[] {
  const out: BookingDate[] = [];
  for (let i = 0; i < DAY_WINDOW; i++) {
    // Anchor the iteration at SAST midnight to avoid the UTC-vs-SAST
    // off-by-one when `i` crosses a day boundary near midnight.
    const anchor = new Date(`${todayIso}T00:00:00${SAST_OFFSET}`);
    anchor.setUTCDate(anchor.getUTCDate() + i);
    const iso = isoDateInSAST(anchor);
    const dowIdx = sastDayOfWeek(anchor);
    const dayLabel = String(
      Number.parseInt(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: SAST_TZ,
          day: "numeric",
        }).format(anchor),
        10,
      ),
    );
    out.push({
      iso,
      dow: DOW_LABELS[dowIdx],
      day: dayLabel,
      closed: false,
      is_today: iso === todayIso,
      is_selected: iso === selectedIso,
    });
  }
  return out;
}

function isoDateInSAST(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SAST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function sastDayOfWeek(d: Date): number {
  // 0=Sun..6=Sat, evaluated in SAST.
  const w = new Intl.DateTimeFormat("en-US", {
    timeZone: SAST_TZ,
    weekday: "short",
  }).format(d);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[w] ?? 0;
}

/** Builds the per-slot grid for `dateIso` — pure construction. The
 *  caller layers `available_rinks` + `bookings_in_slot` on top by
 *  running an overlap check against the day's bookings. */
export function buildSlotShells(dateIso: string): Array<{
  starts_at: string;
  ends_at: string;
  starts_label: string;
  ends_label: string;
}> {
  return SLOT_HOURS.map(([startH, endH]) => {
    const starts_at = new Date(
      `${dateIso}T${pad2(startH)}:00:00${SAST_OFFSET}`,
    ).toISOString();
    const ends_at = new Date(
      `${dateIso}T${pad2(endH)}:00:00${SAST_OFFSET}`,
    ).toISOString();
    return {
      starts_at,
      ends_at,
      starts_label: `${pad2(startH)}:00`,
      ends_label: `${pad2(endH)}:00`,
    };
  });
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Returns true when `a` and `b` (both `[start, end)` ranges) overlap. */
function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);
}

/** Layered closure detection. `booking_windows.is_closure = true` rows
 *  apply EITHER as a recurring weekday (when `weekday` is set 0-6,
 *  Sun=0) OR as a one-off date range (`starts_date`..`ends_date`).
 *  Rows with neither set are admin-error and ignored. */
export function dateIsClosed(
  iso: string,
  closureWindows: Array<{
    weekday: number | null;
    starts_date: string | null;
    ends_date: string | null;
  }>,
): boolean {
  const dow = sastDayOfWeek(new Date(`${iso}T00:00:00${SAST_OFFSET}`));
  for (const w of closureWindows) {
    if (w.weekday != null && w.weekday === dow) return true;
    if (w.starts_date && w.ends_date) {
      if (iso >= w.starts_date && iso <= w.ends_date) return true;
    }
  }
  return false;
}

const PURPOSE_LABEL_MAP: Record<DbBookingPurpose, string> = {
  roll_up: "Roll-up",
  practice: "Practice",
  coaching: "Coaching",
  match: "Match",
  social: "Social",
};

export function purposeLabel(p: DbBookingPurpose): string {
  return PURPOSE_LABEL_MAP[p];
}

export async function getBookingDataForCurrentPlayer(
  selectedDate: string,
): Promise<BookingPageData | null> {
  const club = await getCurrentHostClub();
  if (!club) return null;

  const supabase = await createClient();
  const todayIso = todayIsoSAST();
  const strip = buildDateStrip(todayIso, selectedDate);

  // Closure windows for the player's club — we only need rows where
  // is_closure=true since the date strip starts as fully open and
  // closure overrides.
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
  };
}
