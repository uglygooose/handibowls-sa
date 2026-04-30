"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

// Phase 12 / 12-1 followup — admin Server Action wrapping
// admin_schedule_t20_assessment (migration 037). Validates input via
// Zod, calls the RPC, returns a discriminated result for the client
// island's toast UI.
//
// On success the action revalidates /manage/messages (so the request
// row's "Schedule from this request" CTA disappears or stays — see
// below for why we leave it untouched server-side) and /t20 (player's
// upcoming-assessments list refreshes on the next visit).
//
// Why not auto-resolve the originating request message
//   The brief specifies a one-click jump from the message to the
//   pre-filled form. The act of scheduling does NOT mark the message
//   as "handled" because admins may schedule independently of any
//   request, and a request might receive multiple bookings (e.g.
//   first scheduled, then re-scheduled). Keeping the message lifecycle
//   independent of the booking lifecycle avoids coupling that the
//   schema doesn't support today (no message.handled_at column).

const InputSchema = z.object({
  player_id: z.string().uuid(),
  rink_id: z.string().uuid(),
  starts_at: z.string().refine(
    (v) => {
      const t = new Date(v).getTime();
      return Number.isFinite(t) && t > Date.now() - 5 * 60 * 1000;
    },
    { message: "starts_at must parse as a future ISO timestamp" },
  ),
  duration_minutes: z
    .number()
    .int()
    .min(15)
    .max(240),
  notes: z.string().max(500).nullable().default(null),
});

export type ScheduleT20AssessmentInput = z.infer<typeof InputSchema>;

export type ScheduleT20AssessmentResult =
  | { kind: "ok"; bookingId: string }
  | { kind: "validation"; message: string }
  | {
      kind: "wrong_role" | "wrong_club" | "wrong_player" | "slot_taken" | "bad_input" | "not_authenticated";
    }
  | { kind: "error"; message: string };

export async function adminScheduleT20Assessment(
  raw: unknown,
): Promise<ScheduleT20AssessmentResult> {
  const parsed = InputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      kind: "validation",
      message: parsed.error.issues
        .map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
        .join("; "),
    };
  }

  const startsAt = new Date(parsed.data.starts_at);
  const endsAt = new Date(
    startsAt.getTime() + parsed.data.duration_minutes * 60 * 1000,
  );

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("admin_schedule_t20_assessment", {
      p_player_id: parsed.data.player_id,
      p_rink_id: parsed.data.rink_id,
      p_starts_at: startsAt.toISOString(),
      p_ends_at: endsAt.toISOString(),
      // Optional in the RPC signature; the generated type is
      // `string | undefined`. Coerce null → undefined so we don't
      // send a JSON null that the RPC would interpret as an empty
      // notes value rather than "no notes provided".
      ...(parsed.data.notes != null ? { p_notes: parsed.data.notes } : {}),
    })
    .single();

  if (error) {
    console.error("[bookings/new] admin_schedule_t20_assessment failed:", error);
    return { kind: "error", message: error.message };
  }

  switch (data?.kind) {
    case "ok":
      revalidatePath("/manage/messages");
      revalidatePath("/manage/overview");
      revalidatePath("/t20");
      return { kind: "ok", bookingId: data.booking_id as string };
    case "wrong_role":
    case "wrong_club":
    case "wrong_player":
    case "slot_taken":
    case "bad_input":
    case "not_authenticated":
      return { kind: data.kind };
    default:
      return { kind: "error", message: `Unexpected RPC kind: ${data?.kind}` };
  }
}
