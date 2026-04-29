"use server";

import { z } from "zod";

import { getAuthContext } from "@/lib/auth/role";
import { getCurrentHostClub } from "@/lib/auth/memberships";
import { revalidateBookingSurfaces } from "@/lib/bookings/revalidate";
import { createClient } from "@/lib/supabase/server";

// Phase 8e-2 — createBooking server action.
//
// Contract
//
//   The action accepts a SLOT (start/end pair) plus the booking
//   metadata (purpose / party_size / notes). It does NOT accept
//   rink_id or club_id from the client — both are resolved server-
//   side from the caller's identity. The client can't even see other
//   clubs' rinks via the slot grid (member_read RLS gates it), so
//   asking the client to nominate a rink is unnecessary noise; the
//   server picks the first available rink at the player's primary
//   club and runs.
//
// Race-condition handling
//
//   The matches table's GIST exclusion (`bookings_no_overlap` from
//   migration 005) raises SQLSTATE 23P01 when two clients submit
//   overlapping bookings for the same rink. Two paths produce that:
//
//     (a) Two players race the same slot → same time window. Our
//         pre-flight rink-availability check picks a rink that
//         appeared free, then the GIST constraint rejects on insert
//         because the other client got there first. Mapped to
//         `slot_conflict`. Action layer's caller toasts + refreshes.
//     (b) The same player double-tap-spams the submit. Same code
//         path, same result — `slot_conflict` is the honest answer.
//
//   We don't retry server-side because the player's intent on retry
//   may be different (different purpose, different party — the
//   re-submitted form values would be lost in a silent retry). The
//   client toasts + refreshes the slot grid; the player picks again.
//
// Why createClient (cookie-bound) and not service-role
//
//   The INSERT path goes through the existing `bookings_self_insert`
//   RLS policy:
//     `booked_by = auth.uid() AND club_id ∈ current_club_ids()`.
//   That's an authoritative server-side authorization layer; we
//   route through it on purpose so the policy IS the audit. Service-
//   role would bypass it and we'd be inventing a parallel
//   authorization pathway.

const createBookingSchema = z.object({
  slot_starts_at: z.string().datetime(),
  slot_ends_at: z.string().datetime(),
  purpose: z.enum(["roll_up", "practice", "coaching", "match", "social"]),
  party_size: z.number().int().min(1).max(8).nullable().optional(),
  notes: z.string().trim().max(500).optional(),
});

export type CreateBookingInput = z.input<typeof createBookingSchema>;

export type CreateBookingResult =
  | { kind: "ok"; booking_id: string }
  | { kind: "slot_conflict" }
  | { kind: "no_availability" }
  | { kind: "validation"; error: string; fieldErrors?: Record<string, string[]> }
  | { kind: "auth"; error: string }
  | { kind: "error"; error: string };

const SQLSTATE_GIST_EXCLUSION = "23P01";

export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return { kind: "auth", error: "Not authenticated" };
  }

  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      kind: "validation",
      error: "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const club = await getCurrentHostClub();
  if (!club) {
    return {
      kind: "auth",
      error: "No primary club — ask a club admin to add you.",
    };
  }

  if (
    new Date(parsed.data.slot_ends_at) <= new Date(parsed.data.slot_starts_at)
  ) {
    return { kind: "validation", error: "Slot end must follow slot start." };
  }

  const supabase = await createClient();

  // Pull active rinks at the club (RLS gates: member_read on rinks +
  // greens; the player can see rinks at clubs they belong to).
  const { data: rinkRows, error: rinksErr } = await supabase
    .from("rinks")
    .select("id, number, green:greens!inner(name, club_id)")
    .eq("active", true);
  if (rinksErr) {
    return { kind: "error", error: rinksErr.message };
  }

  const clubRinks = (rinkRows ?? []).filter((r) => {
    const g = r.green as { club_id?: string } | null;
    return g?.club_id === club.club_id;
  });
  if (clubRinks.length === 0) {
    return { kind: "no_availability" };
  }

  // Pull bookings overlapping the requested slot (status='booked'
  // only — cancelled rows release the slot per the GIST WHERE
  // clause). PostgREST doesn't expose tstzrange &&; we approximate
  // with `starts_at < slot_end && ends_at > slot_start`, the
  // standard "ranges overlap" predicate.
  const { data: overlapping, error: overlapErr } = await supabase
    .from("bookings")
    .select("rink_id")
    .eq("club_id", club.club_id)
    .eq("status", "booked")
    .lt("starts_at", parsed.data.slot_ends_at)
    .gt("ends_at", parsed.data.slot_starts_at);
  if (overlapErr) {
    return { kind: "error", error: overlapErr.message };
  }

  const taken = new Set((overlapping ?? []).map((b) => b.rink_id));
  // Deterministic pick: rinks come back ordered by green name then
  // rink number from the migration's index pattern; tie-breaking on
  // number keeps "Main 1 before Main 2" so the same slot lands on
  // the same rink across reruns when no race intervenes. Helps QA
  // reproducibility.
  const pick = clubRinks
    .filter((r) => !taken.has(r.id))
    .sort((a, b) => a.number - b.number)[0];
  if (!pick) {
    return { kind: "no_availability" };
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("bookings")
    .insert({
      rink_id: pick.id,
      club_id: club.club_id,
      booked_by: ctx.userId,
      purpose: parsed.data.purpose,
      starts_at: parsed.data.slot_starts_at,
      ends_at: parsed.data.slot_ends_at,
      party_size: parsed.data.party_size ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();

  if (insertErr) {
    if (insertErr.code === SQLSTATE_GIST_EXCLUSION) {
      return { kind: "slot_conflict" };
    }
    return { kind: "error", error: insertErr.message };
  }

  if (!inserted) {
    // Defensive — RLS denial would surface as data=null + error=null
    // through PostgREST. Treat as a conflict so the UI refreshes
    // rather than telling the player everything's fine.
    return { kind: "slot_conflict" };
  }

  revalidateBookingSurfaces();

  return { kind: "ok", booking_id: inserted.id };
}
