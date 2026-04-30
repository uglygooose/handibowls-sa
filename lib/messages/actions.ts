"use server";

import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

// Phase 11 / 11-2 — sendMessage Server Action.
//
// Thin typed wrapper around the public.send_message(p_message_id)
// SECURITY DEFINER RPC (migration 035). The RPC enforces all the
// business rules (auth, ownership, status guard, audience
// resolution); this wrapper exists to:
//
//   1. Validate the input UUID at the action boundary so a
//      malformed argument returns kind='validation' instead of a
//      Postgres SQLSTATE leak.
//   2. Map the RPC's SQLSTATE / message-prefix error contract to
//      a typed discriminated union the compose UI (11-3) and
//      tests can branch on cleanly.
//   3. Map the RPC's `status='failed'` non-throw return path to
//      `{ ok: false, kind: 'audience_invalid' }` so the UI can
//      surface an actionable error rather than a "succeeded with
//      0 recipients" mirage.
//
// Pattern mirrors Phase 9's cancelOwnBookingAction
// (lib/bookings/actions.ts). The kind taxonomy here uses
// 'forbidden' as a single bucket for both insufficient_role and
// wrong_club because the compose UI surfaces them with the same
// "you don't have access" copy — there's no actionable difference
// for the user. Telemetry / logs preserve the underlying error
// message.

const SendMessageInputSchema = z.object({
  messageId: z.string().uuid(),
});

export type SendMessageInput = z.input<typeof SendMessageInputSchema>;

export type SendMessageResult =
  | { ok: true; recipientCount: number }
  | {
      ok: false;
      kind:
        | "validation"
        | "not_authenticated"
        | "forbidden"
        | "not_found"
        | "wrong_state"
        | "audience_invalid"
        | "error";
      error?: string;
    };

export async function sendMessage(
  input: SendMessageInput,
): Promise<SendMessageResult> {
  const parsed = SendMessageInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      kind: "validation",
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_message", {
    p_message_id: parsed.data.messageId,
  });

  if (error) {
    return mapRpcError(error);
  }

  // Defence: send_message is TABLE-returning so PostgREST surfaces
  // it as an array. The RPC always emits exactly one row.
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return { ok: false, kind: "error", error: "send_message returned no row" };
  }

  if (row.status === "sent") {
    return { ok: true, recipientCount: row.recipient_count };
  }
  if (row.status === "failed") {
    // The RPC transitioned to 'failed' silently for an audience-
    // resolution validation error. Surface as actionable failure
    // rather than masquerading as success.
    return {
      ok: false,
      kind: "audience_invalid",
      error:
        "Audience resolution failed — the message was marked failed without sending.",
    };
  }

  return {
    ok: false,
    kind: "error",
    error: `send_message returned unexpected status: ${row.status}`,
  };
}

// ---------------------------------------------------------------------
// SQLSTATE / message-prefix → kind mapping
// ---------------------------------------------------------------------
//
// The RPC raises with SQLSTATE plus a `send_message: <slug>` message
// prefix (mirrors migration 030's cancel_own_booking pattern). The
// mapper looks at SQLSTATE first (coarse family), then refines on
// the message slug for ambiguous codes (42501 = both not_auth AND
// forbidden).

function mapRpcError(error: { code?: string; message?: string }): SendMessageResult {
  const code = error.code ?? "";
  const msg = error.message ?? "";

  if (code === "42501") {
    if (msg.includes("not_authenticated")) {
      return { ok: false, kind: "not_authenticated", error: msg };
    }
    return { ok: false, kind: "forbidden", error: msg };
  }
  if (code === "P0002" && msg.includes("not_found")) {
    return { ok: false, kind: "not_found", error: msg };
  }
  if (code === "22023" && msg.includes("wrong_state")) {
    return { ok: false, kind: "wrong_state", error: msg };
  }

  return { ok: false, kind: "error", error: msg || "send_message failed" };
}
