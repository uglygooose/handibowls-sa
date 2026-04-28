"use server";

import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth/role";
import {
  MARKETING_VERSION,
  PRIVACY_VERSION,
  TERMS_VERSION,
} from "@/lib/legal/versions";
import { createClient } from "@/lib/supabase/server";

import { setupSchema, type SetupFormValues } from "./_schema";

export type CompleteResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

// Wraps the migration-019 RPC. The Zod parse here narrows the form's
// "" empty-string defaults to typed enum values via the step schemas'
// superRefine — anything left as "" would have errored before reaching
// this server action. Server-side parse re-runs as defense in depth.
export async function completePlayerProfile(
  input: SetupFormValues,
): Promise<CompleteResult> {
  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const v = parsed.data;

  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: "Not authenticated." };

  // Both empty-string and "" enum values should not exist post-parse, but
  // narrow defensively before passing to the RPC's typed args.
  if (
    v.identity.gender === "" ||
    v.bowls.club_grading === "" ||
    v.bowls.dominant_hand === ""
  ) {
    return { ok: false, error: "Required selection missing." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_player_profile", {
    p_first_name: v.identity.first_name,
    p_last_name: v.identity.last_name,
    p_display_name: v.identity.display_name,
    p_gender: v.identity.gender,
    p_date_of_birth: v.identity.date_of_birth,
    p_bsa_number: v.bowls.bsa_number,
    p_dominant_hand: v.bowls.dominant_hand,
    p_phone: v.contact.phone,
    p_email_opt_in: v.contact.email_opt_in,
    p_club_grading: v.bowls.club_grading,
    p_terms_version: TERMS_VERSION,
    p_privacy_version: PRIVACY_VERSION,
    p_marketing_version: MARKETING_VERSION,
  });

  if (error) return { ok: false, error: error.message };

  // Bust the (player) layout chain's cached profile read so the gate sees
  // profile_completed=true on the very next navigation. Without this, the
  // wizard's router.replace('/play') would render against a stale RSC
  // cache where profile_completed=false → the gate redirects back to
  // /me/setup, leaving the player stuck on the wizard.
  revalidatePath("/", "layout");
  return { ok: true };
}
