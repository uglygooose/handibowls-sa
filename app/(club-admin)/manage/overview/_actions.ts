"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth/role";
import { captureWithAuditContext } from "@/lib/observability/captureWithAuditContext";
import { createClient } from "@/lib/supabase/server";

// Phase 9-2 — admin force-cancel server action. Thin wrapper around
// migration 031's `admin_force_cancel_booking(uuid, text)` RPC.
//
// Pattern lifted from `app/(player)/(gated)/book/_actions.ts`'s
// `cancelBooking`: SQLSTATE + message-prefix → typed result kind.
// All authorization is in the RPC — the action's job is Zod gating
// (catches obvious mistakes pre-DB) and result mapping (gives the
// UI a clean discriminated union to switch on).
//
// Reason is required (z.string().min(1).max(500)). The RPC also
// validates length but client-side rejection avoids the round-trip.

const adminForceCancelSchema = z.object({
  booking_id: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
});

export type AdminForceCancelInput = z.input<typeof adminForceCancelSchema>;

export type AdminForceCancelResult =
  | { kind: "ok" }
  | { kind: "not_found" }
  | { kind: "wrong_club" }
  | { kind: "wrong_state" }
  | { kind: "insufficient_role" }
  | { kind: "reason_required" }
  | { kind: "validation"; error: string }
  | { kind: "auth"; error: string }
  | { kind: "error"; error: string };

const RPC_SQLSTATE_NOT_FOUND = "P0002";
const RPC_SQLSTATE_INSUFFICIENT_PRIVILEGE = "42501";
const RPC_SQLSTATE_INVALID_PARAMETER = "22023";
const RPC_SQLSTATE_VALUE_TOO_LONG = "22001";
const RPC_SQLSTATE_NULL_VALUE_NOT_ALLOWED = "22004";

export async function adminForceCancelBooking(
  input: AdminForceCancelInput,
): Promise<AdminForceCancelResult> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return { kind: "auth", error: "Not authenticated" };
  }

  const parsed = adminForceCancelSchema.safeParse(input);
  if (!parsed.success) {
    const reasonIssue = parsed.error.issues.find(
      (i) => i.path[0] === "reason",
    );
    if (reasonIssue) {
      // too_small = empty/min(1) violation → required, too_big = length cap
      // → validation. Differentiating lets the UI surface the right copy
      // without re-checking the input client-side.
      if (reasonIssue.code === "too_small") {
        return { kind: "reason_required" };
      }
      if (reasonIssue.code === "too_big") {
        return {
          kind: "validation",
          error: "Reason must be 500 characters or fewer.",
        };
      }
    }
    return { kind: "validation", error: "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_force_cancel_booking", {
    p_booking_id: parsed.data.booking_id,
    p_reason: parsed.data.reason,
  });

  if (error) {
    const msg = error.message ?? "";
    if (error.code === RPC_SQLSTATE_NOT_FOUND) {
      return { kind: "not_found" };
    }
    if (
      error.code === RPC_SQLSTATE_NULL_VALUE_NOT_ALLOWED ||
      msg.includes("reason_required")
    ) {
      return { kind: "reason_required" };
    }
    if (error.code === RPC_SQLSTATE_VALUE_TOO_LONG) {
      return {
        kind: "validation",
        error: "Reason must be 500 characters or fewer.",
      };
    }
    if (error.code === RPC_SQLSTATE_INSUFFICIENT_PRIVILEGE) {
      if (msg.includes("wrong_club")) return { kind: "wrong_club" };
      if (msg.includes("insufficient_role")) {
        return { kind: "insufficient_role" };
      }
      // Fallback for not_authenticated — defensive, shouldn't fire
      // because the action's ctx-null guard runs first.
      return { kind: "auth", error: "Not authenticated" };
    }
    if (
      error.code === RPC_SQLSTATE_INVALID_PARAMETER ||
      msg.includes("wrong_state")
    ) {
      return { kind: "wrong_state" };
    }
    // Unmatched errcode — Sentry capture with audit context. Mapped
    // errcodes above are deterministic kinds and stay out of the
    // telemetry stream.
    captureWithAuditContext(error, {
      table_name: "bookings",
      action: "admin_force_cancel_booking",
      row_id: parsed.data.booking_id,
      actor_id: ctx.userId,
    });
    return { kind: "error", error: msg || "Cancel failed" };
  }

  revalidatePath("/manage/overview", "page");
  // `/book` and `/me` revalidations cover the player-facing surfaces
  // that derive from this booking's status. Mirrors the
  // `revalidateBookingSurfaces` helper from Phase 8e but kept inline
  // here to avoid pulling the whole helper for one usage.
  revalidatePath("/book", "page");
  revalidatePath("/me", "page");
  return { kind: "ok" };
}
