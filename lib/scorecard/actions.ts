"use server";

import { z } from "zod";

import { getAuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";

// Phase 8d / migration 027 — match-end upsert action. The scorecard's
// Dexie outbox flush calls this once per queued end on reconnect/focus.
//
// Phase 8g — simplified shape. The original Phase 8d contract returned
// `kind: "remote_newer"` when the server's `updated_at` was at-or-after
// the client's `local_updated_at`, expecting a UI conflict-resolution
// modal to surface. That UI was stripped in Phase 8g (real-world
// likelihood of concurrent same-end scoring across two devices, one
// offline, both syncing through different timestamps is effectively
// zero for bowls — players score live on a green with one device).
//
// Current contract: server-side last-write-wins. INSERT when no row
// exists, UPDATE when one does. Migration 027's `match_ends.updated_at`
// + `match_ends_set_updated_at` BEFORE UPDATE trigger still bump the
// stamp on every write; the participant UPDATE/DELETE policies still
// gate access. Both are required for the offline write path that
// genuinely works.
//
// Three outcomes per call:
//
//   • `{ ok: true }`           — server now matches the client's intent
//                                (INSERT or UPDATE applied).
//   • `{ ok: false, kind: "auth" | "validation" }`
//                              — request rejected pre-DB.
//   • `{ ok: false, kind: "db_error" }`
//                              — DB error (RLS denial, constraint
//                                violation, etc.). The flush worker
//                                marks the row errored and surfaces
//                                via the sync badge for retry.
//
// No `revalidatePath` here — by design. Per-end UI is driven by the
// scorecard's Dexie outbox + client-side aggregation: the local row
// is already the source of truth for the captain mid-game. Match-level
// surfaces (admin overview, player scorecard meta, /play) are
// invalidated by the lifecycle actions (`submitMatch`, `confirmMatch`,
// `verifyMatch`) via `revalidateMatchSurfaces` once the match
// transitions, which is the only point where the RSC payload changes.

const upsertMatchEndSchema = z.object({
  match_id: z.string().uuid(),
  end_number: z.number().int().positive(),
  home_shots: z.number().int().min(0).max(99),
  away_shots: z.number().int().min(0).max(99),
  /** ISO timestamp of the local edit. Retained for outbox audit + log
   *  correlation; no longer drives a server-side comparison. */
  local_updated_at: z.string().datetime(),
});

export type UpsertMatchEndInput = z.input<typeof upsertMatchEndSchema>;

export type UpsertMatchEndResult =
  | { ok: true; data: { match_id: string; end_number: number } }
  | {
      ok: false;
      kind: "auth";
      error: string;
    }
  | {
      ok: false;
      kind: "validation";
      error: string;
      fieldErrors?: Record<string, string[]>;
    }
  | {
      ok: false;
      kind: "db_error";
      error: string;
    };

export async function upsertMatchEnd(
  input: UpsertMatchEndInput,
): Promise<UpsertMatchEndResult> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return { ok: false, kind: "auth", error: "Not authenticated" };
  }

  const parsed = upsertMatchEndSchema.safeParse(input);
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
  const v = parsed.data;

  const supabase = await createClient();

  // Probe for an existing row. RLS gates: participants + admins for
  // the match's host club can read.
  const { data: existing, error: selErr } = await supabase
    .from("match_ends")
    .select("id")
    .eq("match_id", v.match_id)
    .eq("end_number", v.end_number)
    .maybeSingle();

  if (selErr) {
    return { ok: false, kind: "db_error", error: selErr.message };
  }

  // Path A — no existing row. INSERT through `match_ends_participant_submit`.
  if (!existing) {
    const { error: insErr } = await supabase.from("match_ends").insert({
      match_id: v.match_id,
      end_number: v.end_number,
      home_shots: v.home_shots,
      away_shots: v.away_shots,
    });
    if (insErr) {
      return { ok: false, kind: "db_error", error: insErr.message };
    }
    return {
      ok: true,
      data: { match_id: v.match_id, end_number: v.end_number },
    };
  }

  // Path B — server already has a row. UPDATE with the client's values
  // (last-write-wins server-side; the trigger bumps `updated_at`). RLS
  // gate (027): participant + not finalized_by_admin. Admin lock
  // surfaces here as a DB error; the flush worker treats unknown DB
  // errors as retryable with backoff.
  const { error: upErr } = await supabase
    .from("match_ends")
    .update({
      home_shots: v.home_shots,
      away_shots: v.away_shots,
    })
    .eq("match_id", v.match_id)
    .eq("end_number", v.end_number);
  if (upErr) {
    return { ok: false, kind: "db_error", error: upErr.message };
  }
  return {
    ok: true,
    data: { match_id: v.match_id, end_number: v.end_number },
  };
}
