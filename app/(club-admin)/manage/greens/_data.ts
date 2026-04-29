import "server-only";

import { getAuthContext } from "@/lib/auth/role";
import { getCurrentHostClub } from "@/lib/auth/memberships";
import { createClient } from "@/lib/supabase/server";

// Phase 9-1 — `/manage/greens` data layer.
//
// One fetcher consumed by the page Server Component. Returns greens
// with their rinks plus the active weekday-recurring closure windows
// for the club. One-off date-range closures (`weekday IS NULL` rows)
// are intentionally excluded from this surface — that's a future
// per-date affordance; the weekly editor only manages the recurring
// schedule.
//
// Pure types + helpers shared with the Client editor live in
// `./grid.ts` (no `'server-only'` directive) so the editor's
// runtime imports don't tip into a server-only module — same
// poisoning-risk pattern Phase 8e-2 codified for `slots.ts`.

export type GreenRink = {
  id: string;
  number: number;
  active: boolean;
};

export type GreenRow = {
  id: string;
  name: string;
  surface: string | null;
  rink_count: number;
  active: boolean;
  rinks: GreenRink[];
};

export type WeekdayClosure = {
  id: string;
  green_id: string | null;
  /** 0 = Sunday, 6 = Saturday — Postgres `extract(dow ...)` convention. */
  weekday: number;
  /** "HH:MM:SS" or "HH:MM" — Postgres time-without-timezone string. */
  starts_time: string;
  ends_time: string;
  label: string | null;
};

export type GreensData =
  | {
      ok: true;
      clubId: string;
      clubName: string;
      greens: GreenRow[];
      closures: WeekdayClosure[];
    }
  | { ok: false; reason: "no-club" };

export async function getGreensData(): Promise<GreensData> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, reason: "no-club" };

  const club = await getCurrentHostClub();
  if (!club) return { ok: false, reason: "no-club" };

  const supabase = await createClient();

  // Greens + their rinks for the club. Inactive rinks are kept in the
  // result so the toggle can flip them back on; player-side queries
  // already filter `active=true` at fetch time (Phase 8e _data).
  const { data: greenRows, error: greensErr } = await supabase
    .from("greens")
    .select(
      "id, name, surface, rink_count, active, rinks(id, number, active)",
    )
    .eq("club_id", club.club_id)
    .order("name", { ascending: true });

  if (greensErr) {
    console.error("[greens] fetch failed:", greensErr);
    return {
      ok: true,
      clubId: club.club_id,
      clubName: club.club_name,
      greens: [],
      closures: [],
    };
  }

  const greens: GreenRow[] = (greenRows ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    surface: g.surface,
    rink_count: g.rink_count,
    active: g.active,
    rinks: ((g.rinks as GreenRink[] | null) ?? [])
      .slice()
      .sort((a, b) => a.number - b.number),
  }));

  // Weekday-recurring closures. `is_closure = true AND weekday IS NOT NULL`
  // pins us to recurring rows; one-off date-range closures (weekday null,
  // starts_date / ends_date set) are excluded — they belong on a separate
  // surface that the weekly grid can't represent.
  const { data: closureRows, error: closuresErr } = await supabase
    .from("booking_windows")
    .select("id, green_id, weekday, starts_time, ends_time, label")
    .eq("club_id", club.club_id)
    .eq("is_closure", true)
    .not("weekday", "is", null)
    .order("weekday", { ascending: true })
    .order("starts_time", { ascending: true });

  if (closuresErr) {
    console.error("[greens] closures fetch failed:", closuresErr);
  }

  // Cast: the `not("weekday", "is", null)` filter guarantees non-null
  // weekday but the type generator can't narrow that.
  const closures: WeekdayClosure[] = (closureRows ?? [])
    .filter(
      (r): r is typeof r & { weekday: number; starts_time: string; ends_time: string } =>
        r.weekday !== null && r.starts_time !== null && r.ends_time !== null,
    )
    .map((r) => ({
      id: r.id,
      green_id: r.green_id,
      weekday: r.weekday,
      starts_time: r.starts_time,
      ends_time: r.ends_time,
      label: r.label,
    }));

  return {
    ok: true,
    clubId: club.club_id,
    clubName: club.club_name,
    greens,
    closures,
  };
}
