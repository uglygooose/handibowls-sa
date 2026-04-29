// Phase 9-1 — pure date/grid helpers + types shared between the
// server fetcher and the Client editor. Lives outside `_data.ts` so
// the editor's runtime imports don't pull a `'server-only'` module
// into the client bundle — same poisoning-risk pattern Phase 8e-2
// codified for `slots.ts`.

/** Hours covered by the editor — 06:00 (inclusive) to 22:00
 *  (exclusive). 16 rows. Wider than the player slot grid
 *  (08-18) so admins can mark early-morning prep + evening
 *  cleanup closures without the editor cropping the range. */
export const EDITOR_HOUR_START = 6;
export const EDITOR_HOUR_END = 22;
export const EDITOR_HOURS: number[] = Array.from(
  { length: EDITOR_HOUR_END - EDITOR_HOUR_START },
  (_, i) => EDITOR_HOUR_START + i,
);

/** 0 = Sunday … 6 = Saturday. Matches Postgres `extract(dow ...)`. */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export const WEEKDAY_LABELS: readonly string[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

export type CellKey = `${number}:${number}`;

export function cellKey(weekday: number, hour: number): CellKey {
  return `${weekday}:${hour}` as CellKey;
}

/** Parses a Postgres time string (`HH:MM:SS` or `HH:MM`) to its hour
 *  component (0..23). Returns null on malformed input — defensive
 *  for the rare admin-error rows. */
export function hourFromTime(s: string): number | null {
  const m = s.match(/^(\d{2}):(\d{2})/);
  if (!m) return null;
  const h = Number.parseInt(m[1], 10);
  return Number.isFinite(h) && h >= 0 && h <= 24 ? h : null;
}

/** Closure window range as the editor models it — half-open
 *  `[startHour, endHour)`. A 09:00–11:00 closure covers hours 9 and
 *  10 (= 2 cells), not 9, 10, 11. */
export type ClosureRangeRow = {
  weekday: number;
  starts_time: string;
  ends_time: string;
};

/** Build the grid's closed-cell set from existing closure rows.
 *  Multiple overlapping rows on the same weekday are unioned —
 *  the grid's "is this hour closed" question is binary. */
export function gridFromClosures(
  closures: ReadonlyArray<ClosureRangeRow>,
): Set<CellKey> {
  const out = new Set<CellKey>();
  for (const c of closures) {
    const start = hourFromTime(c.starts_time);
    const end = hourFromTime(c.ends_time);
    if (start === null || end === null || end <= start) continue;
    const lo = Math.max(start, EDITOR_HOUR_START);
    const hi = Math.min(end, EDITOR_HOUR_END);
    for (let h = lo; h < hi; h++) {
      out.add(cellKey(c.weekday, h));
    }
  }
  return out;
}

/** Convert a flat grid (set of closed cells) back to the canonical
 *  compact range list the server-action persists. Walks each weekday
 *  column once; consecutive closed hours collapse into a single
 *  `{ weekday, starts_time, ends_time }` row. */
export type ClosureRangePayload = {
  weekday: number;
  starts_time: string;
  ends_time: string;
};

export function rangesFromGrid(
  grid: ReadonlySet<CellKey>,
): ClosureRangePayload[] {
  const out: ClosureRangePayload[] = [];
  for (const weekday of WEEKDAYS) {
    let runStart: number | null = null;
    for (let h = EDITOR_HOUR_START; h <= EDITOR_HOUR_END; h++) {
      const inRange = h < EDITOR_HOUR_END && grid.has(cellKey(weekday, h));
      if (inRange && runStart === null) runStart = h;
      if (!inRange && runStart !== null) {
        out.push({
          weekday,
          starts_time: pad2(runStart) + ":00:00",
          ends_time: pad2(h) + ":00:00",
        });
        runStart = null;
      }
    }
  }
  return out;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
