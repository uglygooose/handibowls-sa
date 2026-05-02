"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth/role";
import { maybeRestoreOnLogin } from "@/lib/auth/restore";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// Phase 13 / 13-2b / Batch G1 — POPIA account-lifecycle actions.
//
// Three actions live in this file:
//
//   requestAccountDeletion      — Authenticated user soft-deletes
//                                 their own account. Sets
//                                 profiles.deleted_at = now(),
//                                 starts the 30-day grace window
//                                 timer. pg_cron's nightly
//                                 anonymise job (Batch G3) flips
//                                 pending_auth_ban + NULLs PII
//                                 once the window expires.
//                                 Last-super-admin guard runs
//                                 first.
//
//   restoreAccount              — Authenticated user explicitly
//                                 un-soft-deletes their account
//                                 within the grace window. Calls
//                                 the same maybeRestoreOnLogin
//                                 helper that wires the implicit
//                                 sign-in path; surfaces the
//                                 result as a discriminated kind
//                                 for the UI to render a confirmation.
//
//   superAdminInitiateDeletion  — Super-admin soft-deletes
//                                 another user's account
//                                 (last-resort admin action;
//                                 e.g. abuse / TOS violation /
//                                 compliance request). Same
//                                 last-super-admin guard if the
//                                 target is also a super_admin.
//
// All three:
//   - Action-layer auth + role checks as defence-in-depth (RLS
//     also enforces; failing fast at the action layer keeps the
//     discriminated-kind surface consistent with the rest of the
//     app's actions).
//   - Audit log entry per call, retention_category='compliance'
//     (POPIA Section 23(2)(c) — these are the explicit consent
//     lifecycle events that drive the 7-year retention bucket).
//   - revalidatePath('/me', 'page') so the user's view refreshes
//     with the new deletion / restoration state on next render.

// ---------- requestAccountDeletion ----------

const requestDeletionSchema = z.object({}); // no input — drives off auth.uid()

export type RequestAccountDeletionResult =
  | { kind: "scheduled"; grace_until: string }
  | { kind: "last_super_admin_block" }
  | { kind: "already_scheduled"; grace_until: string }
  | { kind: "auth"; error: string }
  | { kind: "error"; error: string };

export async function requestAccountDeletion(): Promise<RequestAccountDeletionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { kind: "auth", error: "Not authenticated" };

  const _parsed = requestDeletionSchema.safeParse({});
  void _parsed; // Empty schema; kept for symmetry with other actions.

  const supabase = await createClient();

  // Re-read deletion state + role from the DB (don't trust the JWT
  // claim cache — role may have changed mid-session).
  const { data: profile, error: readErr } = await supabase
    .from("profiles")
    .select("role, deleted_at")
    .eq("id", ctx.userId)
    .maybeSingle();
  if (readErr) return { kind: "error", error: readErr.message };
  if (!profile) return { kind: "error", error: "Profile not found" };

  // Idempotent: already-scheduled returns the existing grace_until.
  if (profile.deleted_at) {
    const graceUntil = computeGraceUntil(profile.deleted_at);
    return { kind: "already_scheduled", grace_until: graceUntil };
  }

  // Last-super-admin guard. Runs only if THIS user is a super_admin.
  if (profile.role === "super_admin") {
    const { count, error: countErr } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin")
      .is("deleted_at", null)
      .neq("id", ctx.userId);
    if (countErr) return { kind: "error", error: countErr.message };
    if ((count ?? 0) === 0) return { kind: "last_super_admin_block" };
  }

  const deletedAt = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ deleted_at: deletedAt })
    .eq("id", ctx.userId);
  if (updateErr) return { kind: "error", error: updateErr.message };

  // audit_log INSERT bypasses RLS via service-role per the
  // established pattern (lib/auth/actions.ts:309). audit_log's
  // RLS is super_admin-only-write by design (see migration 031);
  // SECURITY DEFINER RPCs like admin_force_cancel_booking write
  // their own audit row, and self-driven actions like this one
  // use the service client for the same single-write privilege
  // escalation.
  const adminClient = createServiceClient();
  await adminClient.from("audit_log").insert({
    table_name: "profiles",
    row_id: ctx.userId,
    action: "account_deletion_requested",
    reason: "User-initiated soft-delete request.",
    payload: { self_initiated: true } as never,
    performed_by: ctx.userId,
    retention_category: "compliance",
  });

  revalidatePath("/me", "page");
  revalidatePath("/me/settings/data-and-privacy", "page");

  return { kind: "scheduled", grace_until: computeGraceUntil(deletedAt) };
}

// ---------- restoreAccount ----------

export type RestoreAccountResult =
  | { kind: "restored" }
  | { kind: "not_eligible" }
  | { kind: "auth"; error: string }
  | { kind: "error"; error: string };

export async function restoreAccount(): Promise<RestoreAccountResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { kind: "auth", error: "Not authenticated" };

  const supabase = await createClient();
  const { restored } = await maybeRestoreOnLogin(ctx.userId, supabase);
  if (!restored) return { kind: "not_eligible" };

  revalidatePath("/me", "page");
  revalidatePath("/me/settings/data-and-privacy", "page");
  return { kind: "restored" };
}

// ---------- superAdminInitiateDeletion ----------

const adminDeleteSchema = z.object({
  target_user_id: z.string().uuid(),
});

export type SuperAdminInitiateDeletionInput = z.input<typeof adminDeleteSchema>;
export type SuperAdminInitiateDeletionResult =
  | { kind: "scheduled"; grace_until: string }
  | { kind: "last_super_admin_block" }
  | { kind: "already_scheduled"; grace_until: string }
  | { kind: "not_found" }
  | { kind: "validation"; error: string }
  | { kind: "auth"; error: string }
  | { kind: "error"; error: string };

export async function superAdminInitiateDeletion(
  input: SuperAdminInitiateDeletionInput,
): Promise<SuperAdminInitiateDeletionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { kind: "auth", error: "Not authenticated" };
  if (ctx.role !== "super_admin") {
    return { kind: "auth", error: "Super-admin only." };
  }

  const parsed = adminDeleteSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { kind: "validation", error: issue?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const targetId = parsed.data.target_user_id;

  // Re-read target's deletion state + role.
  const { data: target, error: readErr } = await supabase
    .from("profiles")
    .select("role, deleted_at")
    .eq("id", targetId)
    .maybeSingle();
  if (readErr) return { kind: "error", error: readErr.message };
  if (!target) return { kind: "not_found" };

  if (target.deleted_at) {
    const graceUntil = computeGraceUntil(target.deleted_at);
    return { kind: "already_scheduled", grace_until: graceUntil };
  }

  // Last-super-admin guard if the TARGET is a super_admin (deleting
  // a peer admin can leave the platform without one). The acting
  // super_admin is OK because they survive the operation.
  if (target.role === "super_admin") {
    const { count, error: countErr } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin")
      .is("deleted_at", null)
      .neq("id", targetId);
    if (countErr) return { kind: "error", error: countErr.message };
    if ((count ?? 0) === 0) return { kind: "last_super_admin_block" };
  }

  const deletedAt = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ deleted_at: deletedAt })
    .eq("id", targetId);
  if (updateErr) return { kind: "error", error: updateErr.message };

  // Super-admin's session client could write audit_log directly
  // (audit_log_super_admin_all policy permits it), but using the
  // service client keeps the pattern uniform across the file +
  // doesn't depend on the caller's role for the audit-log path
  // working.
  const adminClient = createServiceClient();
  await adminClient.from("audit_log").insert({
    table_name: "profiles",
    row_id: targetId,
    action: "admin_account_deletion",
    reason: "Super-admin-initiated account deletion.",
    payload: {
      target_user_id: targetId,
      initiated_by: ctx.userId,
    } as never,
    performed_by: ctx.userId,
    retention_category: "compliance",
  });

  revalidatePath("/platform/users", "page");
  revalidatePath(`/platform/users/${targetId}`, "page");

  return { kind: "scheduled", grace_until: computeGraceUntil(deletedAt) };
}

// ---------- helpers ----------

// 30-day grace window = deleted_at + 30 days. Stringified ISO so
// the client can render relative dates without re-parsing.
function computeGraceUntil(deletedAt: string): string {
  const t = new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000;
  return new Date(t).toISOString();
}
