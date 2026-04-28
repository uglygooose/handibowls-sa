"use server";

import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";

export type SetPrimaryResult = { ok: true } | { ok: false; error: string };

// Wraps the migration-020 RPC. The RPC's SECURITY DEFINER body re-derives
// the caller and refuses any membership that doesn't belong to them, so
// the lib-level gate is purely a "fail fast on unauthenticated" guard.
export async function setPrimaryClub(
  membershipId: string,
): Promise<SetPrimaryResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: "Not authenticated." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_primary_membership", {
    p_membership_id: membershipId,
  });
  if (error) return { ok: false, error: error.message };

  // Both the (player) layout (TopBar/ClubSwitcher) and /me (membership
  // list) read memberships via getCurrentMemberships(); revalidate the
  // root layout so both surfaces re-fetch on the next request.
  revalidatePath("/", "layout");
  return { ok: true };
}
