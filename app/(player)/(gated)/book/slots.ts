import type { Database } from "@/types/database.types";

// Phase 8e — pure helpers + types for the booking surface.
//
// Lives outside `_data.ts` because Client Components (SlotList,
// BookingSheet) need access to types + the purpose-label map.
// `_data.ts` is `import "server-only"` so it can never be reachable
// from a Client Component bundle. This module is the client-safe
// shared layer; both the server fetcher and the client UI import
// from here.
//
// Contents
//   • types — BookingDate, BookingSlot, BookingRink, BookingInSlot,
//     BookingPageData (the shape getBookingDataForCurrentPlayer
//     returns)
//   • date math — todayIsoSAST, parseDateParam, buildDateStrip,
//     buildSlotShells, dateIsClosed
//   • label map — purposeLabel
//
// SAST anchoring uses the constitutional UTC+2 offset (no DST in
// South Africa); Intl handles SAST date arithmetic via timeZone.

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
  /** "Main 3" — green name + rink number. */
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

export const SAST_OFFSET = "+02:00";
export const SAST_TZ = "Africa/Johannesburg";

const DAY_WINDOW = 14;
const SLOT_HOURS: Array<[number, number]> = [
  [8, 10],
  [10, 12],
  [12, 14],
  [14, 16],
  [16, 18],
];

const DOW_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

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

/** Returns today's date in Africa/Johannesburg as `YYYY-MM-DD`. */
export function todayIsoSAST(now: Date = new Date()): string {
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

/** Returns true when `a` and `b` (both `[start, end)` ranges) overlap. */
export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);
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

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
