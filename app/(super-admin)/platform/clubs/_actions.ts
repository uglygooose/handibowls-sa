"use server";

import { getAuthContext } from "@/lib/auth/role";
import { createInvite, type InviteEmailStatus } from "@/lib/invites/actions";
import { sendInviteEmail } from "@/lib/invites/email";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  assignClubAdminSchema,
  createClubInputSchema,
  updateClubThemeSchema,
  type AssignClubAdminInput,
  type CreateClubInput,
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
): Promise<
  ActionResult<{
    club_id: string;
    admin_invite_token: string | null;
    admin_invite_email_status: InviteEmailStatus;
    admin_invite_email_error?: string;
  }>
> {
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

  const clubId = data as string;

  // Pull the freshly-created admin invite token. Uses the service
  // client because RLS on `invites` is scoped to the invitee — the
  // super-admin creating the club isn't the recipient, so authed
  // select would return an empty set.
  const admin = createServiceClient();
  const { data: invite } = await admin
    .from("invites")
    .select("token")
    .eq("club_id", clubId)
    .eq("email", v.admin_email.toLowerCase())
    .eq("role", "club_admin")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Phase 11 / 11-4a — fire the InviteEmail for the new club's
  // admin invite. Failure is non-blocking: the club + invite row
  // are already written, so the super-admin can resend later. The
  // wizard surfaces the email status as a toast on the detail
  // page (replaced the dev banner pattern in 11-4d).
  let emailStatus: InviteEmailStatus = "skipped";
  let emailError: string | undefined;
  if (invite?.token) {
    const ctx = await getAuthContext();
    const result = await sendInviteEmail({
      token: invite.token,
      invitedByDisplayName: ctx?.email ?? null,
    });
    if (result.status === "sent") {
      emailStatus = "sent";
    } else {
      emailStatus = "failed";
      emailError = result.error;
    }
  }

  return {
    ok: true,
    data: {
      club_id: clubId,
      admin_invite_token: invite?.token ?? null,
      admin_invite_email_status: emailStatus,
      admin_invite_email_error: emailError,
    },
  };
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

// Invite a new club-admin to an existing club. Super-admin only — adding a
// club_admin to a club is a platform operation. Delegates row insertion to
// lib/invites/actions.ts so player-invites and admin-invites share one
// writer.
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

  return createInvite({
    club_id: parsed.data.club_id,
    email: parsed.data.email,
    role: "club_admin",
  });
}
