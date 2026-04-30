"use server";

import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { verifyUnsubscribeToken } from "./unsubscribe";

// Phase 11 / 11-1c — POPIA unsubscribe Server Action.
//
// `unsubscribeFromEmails(token)` is the single mutation surface for
// opting out of HandiBowls emails. The HMAC token IS the auth — the
// caller may not be signed in (in fact usually isn't, since they're
// clicking from an external inbox). After verifying the signature,
// the action flips `profiles.email_opt_in = false` via the service-
// role client (deliberately bypassing RLS — the token gates this).
//
// Result shape mirrors the user's brief: { ok: true } on a fresh
// opt-out; { ok: false, kind } on every other terminal state. The
// page surface treats `kind: 'already_unsubscribed'` as a success-
// equivalent ("you're already unsubscribed") and only renders an
// error card for `invalid_token` and `db_error`.
//
// Why service-role write
//
//   `profiles_self_update` policy allows a signed-in user to flip
//   their own opt-out flag, but unsubscribe requests come in
//   without a session. The token's HMAC binding to `profileId` is
//   the authorization; service-role is the implementation. No
//   leak — the secret never reaches client code (`server-only`
//   guard at the top of unsubscribe.ts).

export type UnsubscribeResult =
  | { ok: true }
  | { ok: false; kind: "invalid_token" | "already_unsubscribed" | "db_error"; error?: string };

export async function unsubscribeFromEmails(
  token: string,
): Promise<UnsubscribeResult> {
  const verified = await verifyUnsubscribeToken(token);
  if (!verified) {
    return { ok: false, kind: "invalid_token" };
  }

  const supabase = createServiceClient();

  // Read current opt-in state first so we can distinguish the
  // first-time opt-out from a re-click on the same link.
  const { data: profile, error: readErr } = await supabase
    .from("profiles")
    .select("id, email_opt_in")
    .eq("id", verified.profileId)
    .maybeSingle();

  if (readErr) {
    console.error("[email/unsubscribe] profile read failed:", readErr);
    return { ok: false, kind: "db_error", error: readErr.message };
  }
  if (!profile) {
    // Token is HMAC-valid but the profile was deleted in the
    // meantime. Treat as invalid so we don't leak existence info.
    return { ok: false, kind: "invalid_token" };
  }
  if (profile.email_opt_in === false) {
    return { ok: false, kind: "already_unsubscribed" };
  }

  const { error: writeErr } = await supabase
    .from("profiles")
    .update({ email_opt_in: false })
    .eq("id", verified.profileId);

  if (writeErr) {
    console.error("[email/unsubscribe] profile update failed:", writeErr);
    return { ok: false, kind: "db_error", error: writeErr.message };
  }

  return { ok: true };
}
