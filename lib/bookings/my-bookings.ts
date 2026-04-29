import "server-only";

import { getAuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";

import {
  formatWhenLabel,
  type MyBookingRow,
} from "@/app/(player)/(gated)/book/slots";

// Phase 8e-3 — MyBookings data fetcher. Used by both /book (compact
// inline) and /me (full list). Variant chooses the row budget; the
// shape returned is identical so the shared component renders both.
//
// Compact: next 3 upcoming + most recent 2 past = 5 rows max.
// Full: all upcoming + last 20 past (cap protects against runaway
// history scrolls; pagination ships with Phase 12 stats work).
//
// `cancellable` mirrors the cancel_own_booking RPC's preconditions
// (booked state + starts_at > now + 2h) so the UI hides the button
// when the action would reject. Server-of-truth lives in the RPC;
// this is a defensive pre-flight read.

export type MyBookingsVariant = "compact" | "full";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export async function getMyBookingsForCurrentPlayer(
  variant: MyBookingsVariant = "compact",
): Promise<MyBookingRow[]> {
  const ctx = await getAuthContext();
  if (!ctx) return [];

  const supabase = await createClient();

  const upcomingLimit = variant === "compact" ? 3 : 50;
  const pastLimit = variant === "compact" ? 2 : 20;
  const nowIso = new Date().toISOString();

  // Upcoming = booked + ends in future. Sort ascending so soonest is
  // first.
  const { data: upcoming } = await supabase
    .from("bookings")
    .select(
      "id, status, purpose, party_size, starts_at, ends_at, rink:rinks!inner(number, green:greens!inner(name))",
    )
    .eq("booked_by", ctx.userId)
    .eq("status", "booked")
    .gt("ends_at", nowIso)
    .order("starts_at", { ascending: true })
    .limit(upcomingLimit);

  // Past = either cancelled OR ended-in-past. Sort descending so most
  // recent is first.
  const { data: past } = await supabase
    .from("bookings")
    .select(
      "id, status, purpose, party_size, starts_at, ends_at, rink:rinks!inner(number, green:greens!inner(name))",
    )
    .eq("booked_by", ctx.userId)
    .or(`status.eq.cancelled,ends_at.lte.${nowIso}`)
    .order("ends_at", { ascending: false, nullsFirst: false })
    .limit(pastLimit);

  const now = new Date(nowIso);
  const rows: MyBookingRow[] = [];
  const seen = new Set<string>();

  for (const row of [...(upcoming ?? []), ...(past ?? [])]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push(toRow(row, now));
  }

  // Final ordering: upcoming (asc by starts_at), past (desc by ends_at)
  // so the compact variant reads top-to-bottom as "next, ..., recent".
  rows.sort((a, b) => {
    if (a.is_past !== b.is_past) return a.is_past ? 1 : -1;
    if (!a.is_past) {
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    }
    return new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime();
  });

  return rows;
}

function toRow(
  raw: {
    id: string;
    status: MyBookingRow["status"];
    purpose: MyBookingRow["purpose"];
    party_size: number | null;
    starts_at: string;
    ends_at: string;
    rink: unknown;
  },
  now: Date,
): MyBookingRow {
  const rink = raw.rink as
    | { number?: number; green?: { name?: string } | null }
    | null;
  const greenName = rink?.green?.name ?? "Green";
  const rinkLabel = `${greenName} ${rink?.number ?? "?"}`;

  const starts = new Date(raw.starts_at);
  const ends = new Date(raw.ends_at);
  const isPast = raw.status !== "booked" || ends.getTime() <= now.getTime();
  const cancellable =
    raw.status === "booked" &&
    starts.getTime() > now.getTime() + TWO_HOURS_MS;

  return {
    id: raw.id,
    starts_at: raw.starts_at,
    ends_at: raw.ends_at,
    when_label: formatWhenLabel(raw.starts_at, raw.ends_at, now),
    rink_label: rinkLabel,
    purpose: raw.purpose,
    party_size: raw.party_size,
    cancellable,
    is_past: isPast,
    status: raw.status,
  };
}
