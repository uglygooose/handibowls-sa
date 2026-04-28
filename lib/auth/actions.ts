"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { homeFor, type UserRole } from "@/lib/auth/role";
import { roleFromAccessToken } from "@/lib/auth/jwt";

export type AuthFormState = {
  ok?: boolean;
  error?: string;
};

function getString(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}

async function siteUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

// Email + password sign-in. Redirects to `next` param or role home on success.
export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const next = getString(formData, "next");
  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: error.message };

  // Role lives in the JWT's app_metadata claim (injected by the hook), not in
  // auth.users.raw_app_meta_data. See lib/auth/jwt.ts.
  const role: UserRole = roleFromAccessToken(data.session?.access_token) ?? "player";

  redirect(next || homeFor(role));
}

// Email + password sign-up. The profiles row is auto-created by the
// handle_new_user() trigger with role='player' and profile_completed=false;
// this action then writes first_name / last_name from the form into that
// row so /me/setup step 1 can prefill them.
export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const firstName = getString(formData, "first_name");
  const lastName = getString(formData, "last_name");
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await siteUrl()}/auth/callback` },
  });
  if (error) return { error: error.message };

  const userId = data.user?.id;
  if (userId && (firstName || lastName)) {
    // Service client: the handle_new_user trigger has just inserted the
    // profile row in the same transaction as auth.signUp. We update it
    // from outside RLS because the session isn't necessarily set yet
    // (email-confirmation flows may suppress immediate sign-in).
    const admin = createServiceClient();
    await admin
      .from("profiles")
      .update({
        first_name: firstName || null,
        last_name: lastName || null,
      })
      .eq("id", userId);
  }

  redirect("/me/setup");
}

// Magic link fallback — sends a one-time email link. Honoured on /login.
export async function signInWithMagicLinkAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = getString(formData, "email");
  if (!email) return { error: "Email is required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await siteUrl()}/auth/callback` },
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export type InviteLookupReason = "missing" | "not-found" | "used" | "expired";

export type InviteLookup =
  | {
      ok: true;
      email: string;
      role: UserRole;
      firstName: string | null;
      lastName: string | null;
      clubId: string;
      clubName: string;
      clubThemePreset: string;
    }
  | { ok: false; error: string; reason: InviteLookupReason };

// Server-side invite lookup. Uses service-role to read the invite row (anon
// RLS doesn't allow reading invites). Returns only safe fields + a machine
// reason so the UI can pick the right illustration.
export async function lookupInvite(token: string): Promise<InviteLookup> {
  if (!token) return { ok: false, error: "Missing invite token.", reason: "missing" };

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("invites")
    .select(
      "email, role, first_name, last_name, club_id, status, expires_at, clubs(name, theme_preset)",
    )
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return { ok: false, error: "Invite not found.", reason: "not-found" };
  if (data.status !== "pending") {
    return { ok: false, error: "Invite has already been used or revoked.", reason: "used" };
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Invite has expired.", reason: "expired" };
  }
  return {
    ok: true,
    email: data.email,
    role: data.role,
    firstName: data.first_name,
    lastName: data.last_name,
    clubId: data.club_id,
    clubName: data.clubs?.name ?? "Your club",
    // core-black is the universal fallback when a club has no theme preset
    // (also the platform/super-admin default).
    clubThemePreset: (data.clubs?.theme_preset as string | null) ?? "core-black",
  };
}

// Accept invite — creates the auth user with the chosen password, links the
// profile to the invite's club (as member or admin), marks the invite used.
// Uses the service-role client for user creation and club linkage; relies on
// the handle_new_user() trigger to create the profiles row.
export async function acceptInviteAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const token = getString(formData, "token");
  const password = getString(formData, "password");
  if (!token || !password) return { error: "Missing token or password." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const lookup = await lookupInvite(token);
  if (!lookup.ok) return { error: lookup.error };

  const admin = createServiceClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: lookup.email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    return { error: createError?.message ?? "Could not create account." };
  }

  const profileId = created.user.id;

  // Carry first_name / last_name from the invite row to the profile, mirroring
  // signUpAction's wire-up. The /me/setup wizard will prefill step 1 from
  // these and let the player edit before submit.
  const profilePatch: { role?: UserRole; first_name?: string | null; last_name?: string | null } = {};
  if (lookup.role === "club_admin") profilePatch.role = "club_admin";
  if (lookup.firstName !== null) profilePatch.first_name = lookup.firstName;
  if (lookup.lastName !== null) profilePatch.last_name = lookup.lastName;
  if (Object.keys(profilePatch).length > 0) {
    await admin.from("profiles").update(profilePatch).eq("id", profileId);
  }

  if (lookup.role === "club_admin") {
    await admin.from("club_admin_assignments").insert({
      profile_id: profileId,
      club_id: lookup.clubId,
    });
  } else {
    // First membership becomes is_primary=true; subsequent invites add as
    // non-primary so the partial unique index club_memberships_one_primary
    // can't be tripped. Player switches via the dual-club switcher (5e).
    const { data: existingPrimary } = await admin
      .from("club_memberships")
      .select("id")
      .eq("profile_id", profileId)
      .eq("is_primary", true)
      .maybeSingle();
    await admin.from("club_memberships").insert({
      profile_id: profileId,
      club_id: lookup.clubId,
      is_primary: !existingPrimary,
      status: "active",
    });
  }

  await admin
    .from("invites")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_profile_id: profileId,
    })
    .eq("token", token);

  // Log the new user in so they land straight on their role home.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: lookup.email,
    password,
  });
  if (signInError) return { error: signInError.message };

  redirect(homeFor(lookup.role));
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
