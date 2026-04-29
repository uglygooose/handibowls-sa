"use server";

import { z } from "zod";

import { getAuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";

// Phase 8d / migration 027 — match-end LWW upsert action. The scorecard's
// Dexie outbox flush calls this once per queued end on reconnect/focus.
// Three outcomes per call:
//
//   • `{ ok: true }`           — server now matches the client's intent
//                                (INSERT or UPDATE applied).
//   • `{ ok: false,
//       kind: "remote_newer",
//       server: {...} }`        — server's row is at least as new as the
//                                client's `local_updated_at`. Conflict.
//                                The client opens the conflict-resolution
//                                modal so the player picks "use mine"
//                                (force overwrite) / "use theirs" /
//                                "dispute".
//   • `{ ok: false, kind: ... }` — auth, validation, or DB error. Each
//                                kind has a stable string for the flush
//                                worker to branch on.
//
// LWW logic lives in TypeScript here rather than a SECURITY DEFINER RPC
// because RLS already enforces participant-only access (migration 027)
// and the server-action surface gives us cleaner Zod + ActionResult
// ergonomics for the conflict-shape contract. Two round-trips on
// conflict — common-path INSERT is one trip.

const upsertMatchEndSchema = z.object({
  match_id: z.string().uuid(),
  end_number: z.number().int().positive(),
  home_shots: z.number().int().min(0).max(99),
  away_shots: z.number().int().min(0).max(99),
  /** ISO timestamp of the local edit that produced these scores. The
   *  server compares this against the existing row's `updated_at` to
   *  pick a winner. */
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
      kind: "remote_newer";
      server: { home_shots: number; away_shots: number; updated_at: string };
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
  const localUpdatedAt = new Date(v.local_updated_at);
  if (Number.isNaN(localUpdatedAt.getTime())) {
    return {
      ok: false,
      kind: "validation",
      error: "local_updated_at is not a valid ISO timestamp",
    };
  }

  const supabase = await createClient();

  // Read existing row — RLS gates: participants + admins for the match's
  // host club can read.
  const { data: existing, error: selErr } = await supabase
    .from("match_ends")
    .select("home_shots, away_shots, updated_at")
    .eq("match_id", v.match_id)
    .eq("end_number", v.end_number)
    .maybeSingle();

  if (selErr) {
    return { ok: false, kind: "db_error", error: selErr.message };
  }

  // Path A — no existing row. INSERT. Migration-027-installed UPDATE
  // policy isn't on the path; INSERT goes through the existing
  // `match_ends_participant_submit` policy.
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

  // Path B — server already has a row. Compare timestamps. Use >= so
  // a tie goes to the server (treat as remote-newer); ties are vanishingly
  // rare in practice but the deterministic tiebreak avoids flapping when
  // two clients write within the same millisecond.
  const serverUpdatedAt = new Date(existing.updated_at);
  if (serverUpdatedAt >= localUpdatedAt) {
    return {
      ok: false,
      kind: "remote_newer",
      server: {
        home_shots: existing.home_shots,
        away_shots: existing.away_shots,
        updated_at: existing.updated_at,
      },
    };
  }

  // Path C — local is newer. UPDATE. RLS gate (027): participant +
  // not finalized_by_admin. Admin lock surfaces here as a DB error;
  // the flush worker treats unknown DB errors as retryable with backoff.
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
