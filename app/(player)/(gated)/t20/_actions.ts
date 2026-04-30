"use server";

import { revalidatePath } from "next/cache";

import { getCurrentMemberships } from "@/lib/auth/memberships";
import { getAuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";

import { getCurrentPlayerT20Profile } from "./_data";

// Phase 12 / 12-1 followup — player-initiated Twenty 20 assessment
// request action. Wraps the request_t20_assessment(p_club_id) RPC
// (migration 037) and returns a discriminated result for the
// /t20 hero CTA's toast UI.
//
// Target club resolution (matches the hero-theme logic from 12-1):
//   1. If the player has a latest submitted assessment, request goes
//      to that club (matches the hero band's tinted-by-latest-club
//      visual contract).
//   2. Otherwise, request goes to the player's primary club.
//   3. If neither exists (no memberships at all), return 'no_club'.

export type RequestT20Result =
  | { kind: "ok"; clubName: string; recipientCount: number; messageId: string }
  | { kind: "throttled"; clubName: string; messageId: string }
  | { kind: "no_admins"; clubName: string }
  | { kind: "no_club" }
  | { kind: "wrong_club" }
  | { kind: "not_authenticated" }
  | { kind: "error"; message: string };

export async function requestT20Assessment(): Promise<RequestT20Result> {
  const ctx = await getAuthContext();
  if (!ctx) return { kind: "not_authenticated" };

  // Resolve the target club using the same precedence the page uses
  // for the hero band — one source of truth so the toast text matches
  // the visual context.
  const [profile, memberships] = await Promise.all([
    getCurrentPlayerT20Profile(),
    getCurrentMemberships(),
  ]);

  const targetClubId =
    profile.latest?.club_id ??
    memberships.find((m) => m.is_primary)?.club_id ??
    memberships[0]?.club_id ??
    null;

  if (!targetClubId) return { kind: "no_club" };

  const targetClubName =
    profile.latest?.club_name ??
    memberships.find((m) => m.club_id === targetClubId)?.club_name ??
    "your club";

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("request_t20_assessment", { p_club_id: targetClubId })
    .single();

  if (error) {
    console.error("[t20] request_t20_assessment RPC failed:", error);
    return { kind: "error", message: error.message };
  }

  // The RPC returns a single-row table — discriminate on kind.
  switch (data?.kind) {
    case "ok":
      revalidatePath("/t20");
      return {
        kind: "ok",
        clubName: targetClubName,
        recipientCount: data.recipient_count ?? 0,
        messageId: data.message_id as string,
      };
    case "throttled":
      return {
        kind: "throttled",
        clubName: targetClubName,
        messageId: data.message_id as string,
      };
    case "no_admins":
      return { kind: "no_admins", clubName: targetClubName };
    case "wrong_club":
      return { kind: "wrong_club" };
    case "not_authenticated":
      return { kind: "not_authenticated" };
    default:
      return { kind: "error", message: `Unexpected RPC kind: ${data?.kind}` };
  }
}
