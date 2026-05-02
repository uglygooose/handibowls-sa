import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createServiceClient } from "@/lib/supabase/service";

// Phase 13 / 13-2b / Batch G1 — implicit restore-on-login helper.
//
// Centralises the "user signs back in within the 30-day grace
// window → silently un-soft-delete" logic so every auth entry
// point (signInAction, /auth/callback OAuth/magic-link exchange,
// future flows) can call the same routine.
//
// Eligibility for silent restore:
//   - deleted_at IS NOT NULL (the user has a pending soft-delete)
//   - pending_auth_ban = false (the pg_cron anonymise job hasn't
//     run yet — once it does, the auth.users row is queued for
//     ban via Vercel Cron and the user CAN'T sign in anyway)
//
// What restore does:
//   - UPDATE profiles SET deleted_at = NULL on the user's own row
//   - Audit log: action='account_deletion_restored',
//     retention_category='compliance', table_name='profiles',
//     row_id=user_id, performed_by=user_id
//
// What restore does NOT do:
//   - Touch pending_auth_ban or auth_banned_at — they're
//     already false / NULL by precondition.
//   - Re-prompt for consent. Per scoping § 8.3 (locked decision):
//     original consent stays valid through the grace window;
//     restoration is a continuation of the same legal
//     relationship, not a new one.
//
// Returns { restored: boolean } so callers can surface a flash
// message if they want to ("your account was restored"). v1
// callers ignore the return value — the restore is silent.

type RestoreResult = { restored: boolean };

export async function maybeRestoreOnLogin(
  userId: string,
  supabase: SupabaseClient<Database>,
): Promise<RestoreResult> {
  const { data, error } = await supabase
    .from("profiles")
    .select("deleted_at, pending_auth_ban")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return { restored: false };
  if (data.deleted_at == null) return { restored: false };
  if (data.pending_auth_ban === true) return { restored: false };

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ deleted_at: null })
    .eq("id", userId);

  if (updateErr) return { restored: false };

  // Audit log entry — compliance-tier (POPIA Section 23(2)(c)
  // retention applies to deletion + restoration events
  // equivalently). The performed_by + row_id both point at the
  // same user since this is the implicit self-restore path.
  //
  // INSERT goes through the service client because audit_log's
  // RLS is super_admin-only-write by design (migration 031);
  // self-driven audit writes like this one use service-role for
  // the single-write privilege escalation. Same pattern as
  // lib/auth/actions.ts:309 (invite-accept audit row).
  const adminClient = createServiceClient();
  await adminClient.from("audit_log").insert({
    table_name: "profiles",
    row_id: userId,
    action: "account_deletion_restored",
    reason: "Implicit restore on sign-in within grace window.",
    payload: { self_initiated: true } as never,
    performed_by: userId,
    retention_category: "compliance",
  });

  return { restored: true };
}
