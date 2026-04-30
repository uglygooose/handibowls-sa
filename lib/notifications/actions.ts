"use server";

import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

// Phase 11 / 11-5 — mark-read mutations for the bell + inbox.
//
// Two surfaces share these actions:
//   • NotificationsBell dropdown (tap a notification → mark read +
//     navigate to related entity)
//   • /me/inbox tap-to-mark-read on both the notifications list and
//     the message_recipients list
//
// RLS does the authorization work: notifications_self_update and
// (when 11-5c lands) message_recipients_self_update both gate on
// `profile_id = auth.uid()`. The action layer just calls UPDATE
// against the authed client and surfaces typed results — no
// service-role escapation needed.
//
// Idempotency: marking an already-read row read again is a no-op
// at the DB level (UPDATE returns same shape; row counts as 1
// affected). The action treats both "freshly marked" and "already
// read" as success.

const idSchema = z.string().uuid();

export type MarkReadResult =
  | { ok: true }
  | { ok: false; kind: "validation" | "not_found" | "auth" | "error"; error?: string };

export async function markNotificationRead(
  notificationId: string,
): Promise<MarkReadResult> {
  if (!idSchema.safeParse(notificationId).success) {
    return { ok: false, kind: "validation", error: "Invalid notification id." };
  }
  const supabase = await createClient();
  // RLS-scoped UPDATE — `profile_id = auth.uid()` is the gate. A
  // wrong id silently affects zero rows; we don't surface that
  // distinct from "row not found" because the user shouldn't be
  // able to reason about other users' notification ids.
  const { error } = await supabase
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) return { ok: false, kind: "error", error: error.message };
  return { ok: true };
}

export async function markMessageRecipientRead(
  recipientId: string,
): Promise<MarkReadResult> {
  if (!idSchema.safeParse(recipientId).success) {
    return { ok: false, kind: "validation", error: "Invalid recipient id." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("message_recipients")
    .update({ in_app_status: "read", read_at: new Date().toISOString() })
    .eq("id", recipientId);
  if (error) return { ok: false, kind: "error", error: error.message };
  return { ok: true };
}
