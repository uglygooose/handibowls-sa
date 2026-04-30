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

// Phase 11 / 11-4b — Accept invite, dual-path.
//
// Old behaviour (broken pre-11-4b): always called auth.admin.createUser.
// A second invite to an email that already had an auth.users row
// returned "user already registered" — DRIFT 161 in DRIFT_LOG.
//
// New behaviour:
//   • Look up an existing auth user by email first (via profiles —
//     auth.users.id == profiles.id by handle_new_user trigger).
//   • If exists → the password field on the form is ignored; we
//     just add the new club_membership / club_admin_assignment,
//     mark the invite accepted, audit the change, sign out the
//     current session (forces JWT rotation — DRIFT 162 closure)
//     and redirect to /login?invited_to=<club_name>. The login
//     page surfaces a confirmation banner and the user re-signs-in
//     with their existing credentials. The fresh sign-in fires the
//     custom_access_token_hook (mig 009) which re-reads
//     club_memberships and bakes the new club into club_ids on the
//     fresh JWT.
//   • If not → existing path: createUser + profile patch +
//     membership + revoke invite + signInWithPassword + redirect
//     home. Unchanged from the original happy path.
//
// Why a server-side signOut over a client-side auth.refreshSession()
//
//   refreshSession() relies on the refresh-token round-trip; under
//   the SECURITY DEFINER token-hook model, that round-trip mints a
//   new access token but the cached app_metadata is from the
//   original session's user query. Forcing a full sign-in
//   guarantees the JWT hook runs against the post-membership
//   club_memberships state. Net cost is one re-auth dialog; net
//   gain is a guaranteed-correct token for every subsequent
//   request.
//
// Audit row: writes to public.audit_log with table_name=
// 'club_memberships' (or 'club_admin_assignments') so super-admins
// can trace cross-club access grants. The audit_log_visible_to_admin
// helper currently only handles 'bookings' (DRIFT line 61); club-
// admin visibility into membership audits is a future-phase
// extension, not 11-4b scope. super_admins can still read all
// audit rows via the super_admin_all policy.

export async function acceptInviteAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const token = getString(formData, "token");
  const password = getString(formData, "password");
  if (!token) return { error: "Missing invite token." };

  const lookup = await lookupInvite(token);
  if (!lookup.ok) return { error: lookup.error };

  const admin = createServiceClient();

  // Look up an existing profile by email. profiles.id == auth.users.id
  // (handle_new_user trigger) so this is the cheapest path to "does
  // this email already have an auth account?".
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", lookup.email.toLowerCase())
    .maybeSingle();

  if (existingProfile?.id) {
    // ─── Existing-user branch ─────────────────────────────────────
    return acceptForExistingUser({
      admin,
      token,
      profileId: existingProfile.id,
      lookup,
    });
  }

  // ─── New-user branch ─────────────────────────────────────────────
  if (!password) return { error: "Password is required for a new account." };
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  return acceptForNewUser({ admin, token, password, lookup });
}

// ---------------------------------------------------------------------
// Existing-user branch
// ---------------------------------------------------------------------

async function acceptForExistingUser(args: {
  admin: ReturnType<typeof createServiceClient>;
  token: string;
  profileId: string;
  lookup: Extract<InviteLookup, { ok: true }>;
}): Promise<AuthFormState> {
  const { admin, token, profileId, lookup } = args;

  // 1. Add the club membership / admin assignment idempotently —
  //    duplicate (profile_id, club_id) is a hard error in v1
  //    schema, so we pre-check.
  if (lookup.role === "club_admin") {
    const { data: existingAssignment } = await admin
      .from("club_admin_assignments")
      .select("id")
      .eq("profile_id", profileId)
      .eq("club_id", lookup.clubId)
      .maybeSingle();
    if (!existingAssignment) {
      const { error } = await admin
        .from("club_admin_assignments")
        .insert({ profile_id: profileId, club_id: lookup.clubId });
      if (error) return { error: error.message };
    }
  } else {
    const { data: existingMembership } = await admin
      .from("club_memberships")
      .select("id")
      .eq("profile_id", profileId)
      .eq("club_id", lookup.clubId)
      .maybeSingle();
    if (!existingMembership) {
      // Existing user already has at least one membership → new
      // membership lands non-primary so club_memberships_one_primary
      // can't be tripped.
      const { error } = await admin.from("club_memberships").insert({
        profile_id: profileId,
        club_id: lookup.clubId,
        is_primary: false,
        status: "active",
      });
      if (error) return { error: error.message };
    }
  }

  // 2. Mark the invite accepted.
  await admin
    .from("invites")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_profile_id: profileId,
    })
    .eq("token", token);

  // 3. Audit row — table_name reflects the actual mutation target.
  const auditTable =
    lookup.role === "club_admin"
      ? "club_admin_assignments"
      : "club_memberships";
  await admin.from("audit_log").insert({
    table_name: auditTable,
    row_id: profileId,
    action: "invite_accepted_existing_user",
    reason: `invite token ${token} accepted by existing user (${lookup.email})`,
    payload: { club_id: lookup.clubId, role: lookup.role, token } as never,
    performed_by: profileId,
  });

  // 4. JWT refresh: signOut clears the auth cookie so the user
  //    re-signs in with a fresh JWT that includes the new club_id
  //    via the custom_access_token_hook. DRIFT 162 closure.
  const supabase = await createClient();
  await supabase.auth.signOut();

  // 5. Redirect to /login with a flash hint so the page can
  //    surface "you've been added to {club}" copy.
  const next = encodeURIComponent(homeFor(lookup.role));
  const invitedTo = encodeURIComponent(lookup.clubName);
  redirect(`/login?invited_to=${invitedTo}&next=${next}`);
}

// ---------------------------------------------------------------------
// New-user branch
// ---------------------------------------------------------------------

async function acceptForNewUser(args: {
  admin: ReturnType<typeof createServiceClient>;
  token: string;
  password: string;
  lookup: Extract<InviteLookup, { ok: true }>;
}): Promise<AuthFormState> {
  const { admin, token, password, lookup } = args;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: lookup.email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    return { error: createError?.message ?? "Could not create account." };
  }

  const profileId = created.user.id;

  // Carry first_name / last_name from the invite row to the profile
  // so /me/setup step 1 can prefill them.
  const profilePatch: {
    role?: UserRole;
    first_name?: string | null;
    last_name?: string | null;
  } = {};
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
    // First-time user — first membership becomes is_primary=true.
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

  // Audit row — first-time-acceptance kind for grep-ability against
  // returning-user flows.
  await admin.from("audit_log").insert({
    table_name:
      lookup.role === "club_admin"
        ? "club_admin_assignments"
        : "club_memberships",
    row_id: profileId,
    action: "invite_accepted_new_user",
    reason: `invite token ${token} accepted; new user created (${lookup.email})`,
    payload: { club_id: lookup.clubId, role: lookup.role, token } as never,
    performed_by: profileId,
  });

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
