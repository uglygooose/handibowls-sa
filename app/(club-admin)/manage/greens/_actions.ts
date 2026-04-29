"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthContext, type AuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";

// Phase 9-1 — `/manage/greens` server actions.
//
//   • replaceWeeklyClosures — snapshot-replace the club's weekday-
//     recurring closure set. The editor sends the full canonical
//     range list each save; the action deletes existing recurring
//     rows then inserts the new set inside one PostgREST round-trip
//     pair. One-off date-range closures (`weekday IS NULL` rows) are
//     untouched — the WHERE clause on the DELETE pins to weekday-
//     non-null only.
//
//   • updateRinkActive — flips a rink's `active` flag. Phase 9-1
//     scope: persists the active boolean only. The reason field is
//     collected at the UI layer and surfaced in the success toast,
//     but NOT yet persisted — the audit_log helper (migration 031)
//     currently scopes visibility to table_name='bookings' only;
//     adding rinks coverage requires a tiny migration that lands in
//     9-2 or Phase 12.5 polish. Drift entry tracks. The action keeps
//     the reason in its Zod schema so the contract is stable when
//     persistence lands later.
//
// Both actions go through the cookie-bound supabase client so the
// existing `bookings_club_admin_rw` / `greens_club_admin_rw` /
// `rinks_club_admin_rw` RLS policies are the authoritative gate. No
// service-role bypass. No SECURITY DEFINER RPC required at this
// surface — the writes are simple and the RLS policies already
// scope by club.

const TIME_RE = /^([0-1]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

const closureRangeSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    starts_time: z.string().regex(TIME_RE),
    ends_time: z.string().regex(TIME_RE),
  })
  .refine(
    (r) => timeToMinutes(r.starts_time) < timeToMinutes(r.ends_time),
    { message: "ends_time must be after starts_time", path: ["ends_time"] },
  );

const replaceClosuresSchema = z.object({
  club_id: z.string().uuid(),
  ranges: z.array(closureRangeSchema).max(7 * 24),
});

export type ReplaceWeeklyClosuresInput = z.input<typeof replaceClosuresSchema>;

export type ReplaceWeeklyClosuresResult =
  | { ok: true; data: { inserted: number } }
  | { ok: false; kind: "auth"; error: string }
  | { ok: false; kind: "validation"; error: string; fieldErrors?: Record<string, string[]> }
  | { ok: false; kind: "error"; error: string };

export async function replaceWeeklyClosures(
  input: ReplaceWeeklyClosuresInput,
): Promise<ReplaceWeeklyClosuresResult> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return { ok: false, kind: "auth", error: "Not authenticated" };
  }

  const parsed = replaceClosuresSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      kind: "validation",
      error: "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const allowed = await callerCanWriteClub(ctx, parsed.data.club_id);
  if (!allowed) {
    return { ok: false, kind: "auth", error: "Not authorized for this club" };
  }

  const supabase = await createClient();

  // Delete existing weekday-recurring closures for the club. One-off
  // date-range closures (`weekday IS NULL`) are explicitly preserved.
  const { error: delErr } = await supabase
    .from("booking_windows")
    .delete()
    .eq("club_id", parsed.data.club_id)
    .eq("is_closure", true)
    .not("weekday", "is", null);
  if (delErr) {
    return { ok: false, kind: "error", error: delErr.message };
  }

  if (parsed.data.ranges.length === 0) {
    revalidatePath("/manage/greens", "page");
    return { ok: true, data: { inserted: 0 } };
  }

  const rows = parsed.data.ranges.map((r) => ({
    club_id: parsed.data.club_id,
    weekday: r.weekday,
    starts_time: r.starts_time,
    ends_time: r.ends_time,
    is_closure: true,
  }));

  const { error: insErr } = await supabase.from("booking_windows").insert(rows);
  if (insErr) {
    return { ok: false, kind: "error", error: insErr.message };
  }

  revalidatePath("/manage/greens", "page");
  return { ok: true, data: { inserted: rows.length } };
}

const updateRinkActiveSchema = z
  .object({
    rink_id: z.string().uuid(),
    active: z.boolean(),
    /** Captured at the UI layer when an admin disables a rink so the
     *  success toast can surface it. Required when active=false;
     *  optional when re-enabling. Not yet persisted — Phase 9-2 /
     *  12.5 wires audit_log coverage for table_name='rinks'. */
    reason: z.string().trim().max(500).optional(),
  })
  .refine(
    (v) => v.active || (v.reason !== undefined && v.reason.length > 0),
    {
      message: "reason is required when disabling a rink",
      path: ["reason"],
    },
  );

export type UpdateRinkActiveInput = z.input<typeof updateRinkActiveSchema>;

export type UpdateRinkActiveResult =
  | { ok: true; data: { rink_id: string; active: boolean } }
  | { ok: false; kind: "auth"; error: string }
  | { ok: false; kind: "validation"; error: string; fieldErrors?: Record<string, string[]> }
  | { ok: false; kind: "not_found"; error: string }
  | { ok: false; kind: "error"; error: string };

export async function updateRinkActive(
  input: UpdateRinkActiveInput,
): Promise<UpdateRinkActiveResult> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return { ok: false, kind: "auth", error: "Not authenticated" };
  }

  const parsed = updateRinkActiveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      kind: "validation",
      error: "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const supabase = await createClient();

  // Resolve the rink → green → club. Authorization piggybacks on the
  // greens RLS policy: a club_admin's SELECT only returns greens at
  // clubs they admin, which transitively scopes the rink lookup.
  // super_admin sees everything.
  const { data: rinkRow, error: rinkErr } = await supabase
    .from("rinks")
    .select("id, green:greens!inner(club_id)")
    .eq("id", parsed.data.rink_id)
    .maybeSingle();

  if (rinkErr) {
    return { ok: false, kind: "error", error: rinkErr.message };
  }
  if (!rinkRow) {
    return { ok: false, kind: "not_found", error: "Rink not found" };
  }

  const greenClubId =
    (rinkRow.green as { club_id?: string } | null)?.club_id ?? null;
  if (!greenClubId) {
    return { ok: false, kind: "error", error: "Rink has no green" };
  }
  const allowed = await callerCanWriteClub(ctx, greenClubId);
  if (!allowed) {
    return { ok: false, kind: "auth", error: "Not authorized for this club" };
  }

  const { error: upErr } = await supabase
    .from("rinks")
    .update({ active: parsed.data.active })
    .eq("id", parsed.data.rink_id);

  if (upErr) {
    return { ok: false, kind: "error", error: upErr.message };
  }

  revalidatePath("/manage/greens", "page");
  // Phase 9-2 / 12.5 — audit_log row for the disable reason will land
  // here once `audit_log_visible_to_admin` extends to table_name='rinks'.
  // The reason is intentionally not persisted in 9-1; the toast at the
  // UI layer surfaces it for the immediate session only.
  return {
    ok: true,
    data: {
      rink_id: parsed.data.rink_id,
      active: parsed.data.active,
    },
  };
}

// -------------------- helpers --------------------

async function callerCanWriteClub(
  ctx: AuthContext,
  clubId: string,
): Promise<boolean> {
  if (ctx.role === "super_admin") return true;
  if (ctx.role !== "club_admin") return false;
  return ctx.clubIds.includes(clubId);
}

function timeToMinutes(s: string): number {
  const m = s.match(/^(\d{2}):(\d{2})/);
  if (!m) return -1;
  return Number.parseInt(m[1], 10) * 60 + Number.parseInt(m[2], 10);
}
