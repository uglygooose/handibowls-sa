// Phase 9-2 — pure week-derivation helpers shared between the
// server fetcher and the Client calendar. No `'server-only'`
// directive — Client Components import these for nav button labels
// and pathname construction. Same poisoning-risk pattern Phase 8e-2
// codified for `slots.ts`.

const SAST_TZ = "Africa/Johannesburg";
const SAST_OFFSET = "+02:00";

/** Calendar columns — Monday first, ISO week convention. The grid
 *  reads cleaner this way than Postgres-dow's Sunday-first. The DB
 *  side stays Sunday-first (booking_windows.weekday); only the
 *  display layer flips. */
export const CALENDAR_DAYS = [1, 2, 3, 4, 5, 6, 0] as const;
export const CALENDAR_DAY_LABELS = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
] as const;

/** Same hour range as the 9-1 weekly availability editor (06:00 to
 *  22:00). Wider than the player slot grid so admins can see prep +
 *  cleanup-window bookings if they exist. */
export const CALENDAR_HOUR_START = 6;
export const CALENDAR_HOUR_END = 22;
export const CALENDAR_HOURS: number[] = Array.from(
  { length: CALENDAR_HOUR_END - CALENDAR_HOUR_START },
  (_, i) => CALENDAR_HOUR_START + i,
);

/** Returns today's date in Africa/Johannesburg as `YYYY-MM-DD`. */
export function todayIsoSAST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SAST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Day of week in SAST as Postgres-dow integer (0=Sun..6=Sat). */
function sastDayOfWeek(iso: string): number {
  const w = new Intl.DateTimeFormat("en-US", {
    timeZone: SAST_TZ,
    weekday: "short",
  }).format(new Date(`${iso}T00:00:00${SAST_OFFSET}`));
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

/** Round any ISO date back to the Monday of its ISO week (in SAST).
 *  Result is always a valid ISO date string `YYYY-MM-DD`. */
export function mondayOf(iso: string): string {
  const dow = sastDayOfWeek(iso);
  // Postgres dow: 0=Sun, 1=Mon, …, 6=Sat. Monday offset:
  //   Sun (0) → -6, Mon (1) → 0, Tue (2) → -1, …, Sat (6) → -5.
  const offset = dow === 0 ? -6 : 1 - dow;
  return shiftIso(iso, offset);
}

/** Shift an ISO date by N days. Returns canonical YYYY-MM-DD in SAST. */
export function shiftIso(iso: string, days: number): string {
  const anchor = new Date(`${iso}T00:00:00${SAST_OFFSET}`);
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SAST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(anchor);
}

/** Validates a `?w=` URL param. Falls back to `mondayOf(today)`
 *  on malformed input or non-Monday dates (we don't auto-snap; an
 *  arbitrary date in the URL is treated as malformed so the address
 *  bar always reflects a real Monday). */
export function parseWeekParam(
  input: string | undefined,
  now: Date = new Date(),
): string {
  const todayMon = mondayOf(todayIsoSAST(now));
  if (!input) return todayMon;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return todayMon;
  // Calendar-impossible dates (e.g. 2026-02-30) — JS rolls them
  // silently. Round-trip to detect.
  const parsed = new Date(`${input}T00:00:00${SAST_OFFSET}`);
  if (!Number.isFinite(parsed.getTime())) return todayMon;
  const roundTripped = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
  if (roundTripped !== input) return todayMon;
  // Snap to the Monday of the input's week. Removes the "any date in
  // the URL" footgun while still being lenient on copy-pasted links.
  return mondayOf(input);
}

/** Build the 7 ISO dates Mon..Sun for a given Monday-anchor date. */
export function weekDateRange(mondayIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftIso(mondayIso, i));
}

/** UTC ISO timestamps for a SAST day's [start, end) — used by the
 *  data fetcher to query bookings that overlap the week. */
export function dayBoundsUtc(iso: string): { startUtc: string; endUtc: string } {
  const startUtc = new Date(`${iso}T00:00:00${SAST_OFFSET}`).toISOString();
  const endUtc = new Date(`${iso}T24:00:00${SAST_OFFSET}`).toISOString();
  return { startUtc, endUtc };
}

/** UTC ISO range for an entire 7-day week (Monday SAST 00:00 to
 *  following Monday SAST 00:00). Both bounds inclusive of start /
 *  exclusive of end — half-open. */
export function weekBoundsUtc(mondayIso: string): {
  startUtc: string;
  endUtc: string;
} {
  const startUtc = new Date(`${mondayIso}T00:00:00${SAST_OFFSET}`).toISOString();
  const endUtc = new Date(
    `${shiftIso(mondayIso, 7)}T00:00:00${SAST_OFFSET}`,
  ).toISOString();
  return { startUtc, endUtc };
}

/** "Mon 04 May" / "Sun 10 May" — short SAST label for column headers. */
export function shortDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00${SAST_OFFSET}`);
  const dow = new Intl.DateTimeFormat("en-US", {
    timeZone: SAST_TZ,
    weekday: "short",
  }).format(d);
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAST_TZ,
    day: "numeric",
  }).format(d);
  const month = new Intl.DateTimeFormat("en-US", {
    timeZone: SAST_TZ,
    month: "short",
  }).format(d);
  return `${dow} ${day.padStart(2, "0")} ${month}`;
}

/** Returns the SAST hour (0-23) of a UTC ISO timestamp. */
export function sastHourOf(utcIso: string): number {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: SAST_TZ,
    hour: "2-digit",
    hour12: false,
  }).format(new Date(utcIso));
  return Number.parseInt(formatted, 10);
}

/** Returns the SAST `YYYY-MM-DD` of a UTC ISO timestamp. */
export function sastIsoDateOf(utcIso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SAST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(utcIso));
}
