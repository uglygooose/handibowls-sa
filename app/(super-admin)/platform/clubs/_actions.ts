"use server";

import { getAuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  assignClubAdminSchema,
  createClubInputSchema,
  createInviteSchema,
  updateClubThemeSchema,
  type AssignClubAdminInput,
  type CreateClubInput,
  type CreateInviteInput,
  type UpdateClubThemeInput,
} from "@/lib/validation/clubs";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function requireSuperAdmin(): Promise<ActionResult<true>> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: "Not authenticated." };
  if (ctx.role !== "super_admin") return { ok: false, error: "Super-admin required." };
  return { ok: true, data: true };
}

// Create a new club atomically via the create_club_with_dependencies RPC.
// Delegates row-level validation to the DB function and pre-validates the
// payload shape with Zod so the UI gets field-keyed errors without a round-trip.
export async function createClub(
  input: CreateClubInput,
): Promise<ActionResult<{ club_id: string }>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate;

  const parsed = createClubInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const v = parsed.data;

  // Use the authed server client so auth.uid() and current_role() inside the
  // RPC resolve to the calling super-admin. The function itself is SECURITY
  // DEFINER — RLS is bypassed — but the role check reads the caller's JWT.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_club_with_dependencies", {
    p_name: v.name,
    p_short_name: v.short_name ?? "",
    p_slug: v.slug,
    p_district_id: v.district_id,
    p_city: v.city,
    p_contact_email: v.contact_email ?? "",
    p_contact_phone: v.contact_phone ?? "",
    p_logo_path: v.logo_path ?? "",
    p_theme_preset: v.theme_preset,
    p_admin_email: v.admin_email,
    p_greens: v.greens,
    p_player_emails: v.player_emails,
  });

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "RPC returned no club id." };
  return { ok: true, data: { club_id: data as string } };
}

export async function updateClubTheme(
  input: UpdateClubThemeInput,
): Promise<ActionResult<true>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate;

  const parsed = updateClubThemeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clubs")
    .update({ theme_preset: parsed.data.theme_preset })
    .eq("id", parsed.data.club_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: true };
}

// Invite a new club-admin to an existing club. Emits a pending invite row;
// the accept flow at /invite/[token] writes the club_admin_assignments row.
export async function assignClubAdmin(
  input: AssignClubAdminInput,
): Promise<ActionResult<{ invite_id: string; token: string }>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate;

  const parsed = assignClubAdminSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  return insertInvite({
    club_id: parsed.data.club_id,
    email: parsed.data.email,
    role: "club_admin",
  });
}

export async function createInvite(
  input: CreateInviteInput,
): Promise<ActionResult<{ invite_id: string; token: string }>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate;

  const parsed = createInviteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  return insertInvite(parsed.data);
}

async function insertInvite(args: {
  club_id: string;
  email: string;
  role: "club_admin" | "player";
}): Promise<ActionResult<{ invite_id: string; token: string }>> {
  // Service client: token default + updated_at trigger both run regardless,
  // and we want to return the generated token to the UI without a second
  // round-trip through RLS.
  const admin = createServiceClient();
  const ctx = await getAuthContext();
  const { data, error } = await admin
    .from("invites")
    .insert({
      club_id: args.club_id,
      email: args.email.toLowerCase(),
      role: args.role,
      invited_by: ctx?.userId ?? null,
    })
    .select("id, token")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create invite." };
  return { ok: true, data: { invite_id: data.id, token: data.token } };
}
