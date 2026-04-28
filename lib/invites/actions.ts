"use server";

import { getAuthContext } from "@/lib/auth/role";
import { createServiceClient } from "@/lib/supabase/service";
import {
  createInviteSchema,
  type CreateInviteInput,
} from "@/lib/validation/invites";

export type CreateInviteResult =
  | { ok: true; data: { invite_id: string; token: string } }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

// Single source of truth for invite creation. Two call sites:
//   • assignClubAdmin (super-admin only) → role='club_admin'
//   • SingleInviteModal on /manage/members (club_admin owning the club, or
//     super_admin) → role='player'
// The gate accepts super_admin unconditionally; club_admin only when the
// target club_id appears in their JWT-derived current_club_ids() claim,
// resolved via getAuthContext()'s readClaimsFromJwt path.
//
// The DB write goes through the service client because RLS on `invites` is
// scoped to the invitee's email — the inviter is not the recipient, so the
// authed insert + select would round-trip through RLS twice. Service client
// is correct here for the same reason it is in the Phase-4 createClub flow.
export async function createInvite(
  input: CreateInviteInput,
): Promise<CreateInviteResult> {
  const parsed = createInviteSchema.safeParse(input);
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
  const allowed =
    ctx.role === "super_admin" ||
    (ctx.role === "club_admin" && ctx.clubIds.includes(v.club_id));
  if (!allowed) return { ok: false, error: "Not authorized to invite to this club." };

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("invites")
    .insert({
      club_id: v.club_id,
      email: v.email.toLowerCase(),
      role: v.role,
      first_name: v.first_name ?? null,
      last_name: v.last_name ?? null,
      invited_by: ctx.userId,
    })
    .select("id, token")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create invite." };
  }
  return { ok: true, data: { invite_id: data.id, token: data.token } };
}
