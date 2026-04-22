"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { homeFor, type UserRole } from "@/lib/auth/role";

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

  const rawRole = (data.user?.app_metadata as Record<string, unknown> | undefined)?.role;
  const role: UserRole =
    rawRole === "super_admin" || rawRole === "club_admin" || rawRole === "player"
      ? rawRole
      : "player";

  redirect(next || homeFor(role));
}

// Email + password sign-up. The profiles row is auto-created by the
// handle_new_user() trigger with role='player' and profile_completed=false.
export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = getString(formData, "email");
  const password = getString(formData, "password");
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await siteUrl()}/auth/callback` },
  });
  if (error) return { error: error.message };

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

export type InviteLookup =
  | {
      ok: true;
      email: string;
      role: UserRole;
      clubId: string;
      clubName: string;
    }
  | { ok: false; error: string };

// Server-side invite lookup. Uses service-role to read the invite row (anon
// RLS doesn't allow reading invites). Returns only safe fields.
export async function lookupInvite(token: string): Promise<InviteLookup> {
  if (!token) return { ok: false, error: "Missing invite token." };

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("invites")
    .select("email, role, club_id, status, expires_at, clubs(name)")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return { ok: false, error: "Invite not found." };
  if (data.status !== "pending") return { ok: false, error: "Invite has already been used or revoked." };
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Invite has expired." };
  }
  return {
    ok: true,
    email: data.email,
    role: data.role,
    clubId: data.club_id,
    clubName: data.clubs?.name ?? "Your club",
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

  if (lookup.role === "club_admin") {
    await admin.from("profiles").update({ role: "club_admin" }).eq("id", profileId);
    await admin.from("club_admin_assignments").insert({
      profile_id: profileId,
      club_id: lookup.clubId,
    });
  } else {
    await admin.from("club_memberships").insert({
      profile_id: profileId,
      club_id: lookup.clubId,
      is_primary: true,
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
