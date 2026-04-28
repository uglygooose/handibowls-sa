// Tournament + admin UI date / time formatting.
//
// Per the project standards: dates are stored UTC in the DB and displayed
// in Africa/Johannesburg. `toLocaleDateString()` with no `timeZone` falls
// back to the browser's local zone, which is wrong for any user not on
// SAST. Every surface that renders a tournament date / time MUST go
// through one of these helpers.
//
// Locale is `en-ZA` so day-month-year ordering, "Apr" abbreviations, and
// 24-hour clock (e.g. "14:30") match HandiBowls conventions.

const ZA_TIMEZONE = "Africa/Johannesburg";

const dateFmt = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: ZA_TIMEZONE,
});

const dateLongFmt = new Intl.DateTimeFormat("en-ZA", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: ZA_TIMEZONE,
});

const timeFmt = new Intl.DateTimeFormat("en-ZA", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: ZA_TIMEZONE,
});

const dateTimeFmt = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: ZA_TIMEZONE,
});

function parse(input: string | Date | null | undefined): Date | null {
  if (input == null) return null;
  if (input instanceof Date) {
    return Number.isFinite(input.getTime()) ? input : null;
  }
  const d = new Date(input);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** "09 May 2026" — day, short month, year. Returns "—" for null/empty.
 *  Day is zero-padded — that's what en-ZA's CLDR formatter emits. */
export function formatDateZA(input: string | Date | null | undefined): string {
  const d = parse(input);
  return d ? dateFmt.format(d) : "—";
}

/** "Sat, 09 May 2026" — long form with weekday. */
export function formatDateLongZA(input: string | Date | null | undefined): string {
  const d = parse(input);
  return d ? dateLongFmt.format(d) : "—";
}

/** "14:30" — 24-hour. Returns "—" for null/empty. */
export function formatTimeZA(input: string | Date | null | undefined): string {
  const d = parse(input);
  return d ? timeFmt.format(d) : "—";
}

/** "09 May 2026, 14:30". */
export function formatDateTimeZA(input: string | Date | null | undefined): string {
  const d = parse(input);
  return d ? dateTimeFmt.format(d) : "—";
}

/** "09–10 May 2026" / "30 Apr – 02 May 2026" range collapsing same year /
 *  same month. Returns just the start date if `end` is null/equal. */
export function formatDateRangeZA(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): string {
  const s = parse(start);
  const e = parse(end);
  if (!s) return formatDateZA(end);
  if (!e || s.getTime() === e.getTime()) return formatDateZA(s);

  // Same year + same month → "9–10 May 2026"
  const sParts = dateParts(s);
  const eParts = dateParts(e);
  if (sParts.year === eParts.year && sParts.month === eParts.month) {
    return `${sParts.day}–${eParts.day} ${eParts.monthLabel} ${eParts.year}`;
  }
  // Same year, different month → "30 Apr – 2 May 2026"
  if (sParts.year === eParts.year) {
    return `${sParts.day} ${sParts.monthLabel} – ${eParts.day} ${eParts.monthLabel} ${eParts.year}`;
  }
  // Different years → "30 Dec 2026 – 2 Jan 2027"
  return `${formatDateZA(s)} – ${formatDateZA(e)}`;
}

function dateParts(d: Date): {
  day: string;
  month: string;
  monthLabel: string;
  year: string;
} {
  // Use the same Intl formatter so we get the SAST-shifted day-of-month.
  const partsArr = dateFmt.formatToParts(d);
  const day = partsArr.find((p) => p.type === "day")?.value ?? "";
  const monthLabel = partsArr.find((p) => p.type === "month")?.value ?? "";
  const year = partsArr.find((p) => p.type === "year")?.value ?? "";
  // Numeric month for comparison (Intl doesn't expose it directly with the
  // current formatter spec; re-format with `numeric` month).
  const month = new Intl.DateTimeFormat("en-ZA", {
    month: "numeric",
    timeZone: ZA_TIMEZONE,
  }).format(d);
  return { day, month, monthLabel, year };
}
