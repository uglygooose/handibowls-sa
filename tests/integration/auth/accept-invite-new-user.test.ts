import { afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

vi.mock("server-only", () => ({}));

import { admin, cleanup, seedClub } from "../../rls/helpers";

// Phase 11 / 11-4b — new-user path regression.
//
// The new-user branch is the original happy path: createUser →
// profile patch → membership → revoke invite → signInWithPassword
// → redirect to role home. Coverage:
//   1. New email creates an auth user
//   2. Membership inserted with is_primary=true
//   3. Invite is marked accepted with the freshly-created profile_id
//   4. Audit row recorded with action='invite_accepted_new_user'
//
// Same NEXT_REDIRECT catch + signIn mock as the existing-user file.

vi.mock("next/headers", () => ({
  headers: async () => new Map(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    const e = new Error(`NEXT_REDIRECT;${url}`);
    (e as Error & { digest?: string }).digest = `NEXT_REDIRECT;${url}`;
    throw e;
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({
        data: { session: null, user: null },
        error: null,
      }),
    },
  }),
}));

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

describe("acceptInviteAction · new-user path", () => {
  it("creates the auth user, primary membership, audit row", async () => {
    const a = admin();
    const clubId = await seedClub("New User Path");
    clubs.push(clubId);

    const email = `rls-new-${randomUUID()}@test.handibowls.local`;
    const password = "Test-Password-1!";

    const { data: invite } = await a
      .from("invites")
      .insert({
        club_id: clubId,
        email,
        role: "player",
        invited_by: null,
      })
      .select("token")
      .single();

    const { acceptInviteAction } = await import("@/lib/auth/actions");
    const fd = new FormData();
    fd.set("token", invite!.token);
    fd.set("password", password);

    let redirectTarget: string | null = null;
    try {
      await acceptInviteAction({ ok: undefined }, fd);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.startsWith("NEXT_REDIRECT;")) {
        redirectTarget = msg.slice("NEXT_REDIRECT;".length);
      } else {
        throw e;
      }
    }

    // Redirects to the role home, NOT to /login?invited_to (that's
    // the existing-user branch).
    expect(redirectTarget).not.toBeNull();
    expect(redirectTarget).not.toContain("/login");
    expect(redirectTarget).toContain("/play");

    // The new auth user exists — look it up by email.
    const { data: profile } = await a
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();
    expect(profile).not.toBeNull();
    const profileId = profile!.id;
    users.push(profileId);

    // Membership exists with is_primary=true (first-time user).
    const { data: membership } = await a
      .from("club_memberships")
      .select("profile_id, club_id, status, is_primary")
      .eq("profile_id", profileId)
      .eq("club_id", clubId)
      .maybeSingle();
    expect(membership).not.toBeNull();
    expect(membership?.is_primary).toBe(true);
    expect(membership?.status).toBe("active");

    // Invite revoked.
    const { data: invitePost } = await a
      .from("invites")
      .select("status, accepted_profile_id")
      .eq("token", invite!.token)
      .maybeSingle();
    expect(invitePost?.status).toBe("accepted");
    expect(invitePost?.accepted_profile_id).toBe(profileId);

    // Audit row with the new-user-specific action.
    const { data: auditRows } = await a
      .from("audit_log")
      .select("table_name, action")
      .eq("performed_by", profileId)
      .eq("action", "invite_accepted_new_user");
    expect(auditRows).not.toBeNull();
    expect(auditRows!.length).toBeGreaterThanOrEqual(1);
    expect(auditRows![0].table_name).toBe("club_memberships");
  });

  it("club_admin role inserts into club_admin_assignments instead of club_memberships", async () => {
    const a = admin();
    const clubId = await seedClub("New Admin Path");
    clubs.push(clubId);

    const email = `rls-new-admin-${randomUUID()}@test.handibowls.local`;
    const password = "Test-Password-1!";

    const { data: invite } = await a
      .from("invites")
      .insert({
        club_id: clubId,
        email,
        role: "club_admin",
        invited_by: null,
      })
      .select("token")
      .single();

    const { acceptInviteAction } = await import("@/lib/auth/actions");
    const fd = new FormData();
    fd.set("token", invite!.token);
    fd.set("password", password);

    try {
      await acceptInviteAction({ ok: undefined }, fd);
    } catch {
      // redirect — fine
    }

    const { data: profile } = await a
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    expect(profile).not.toBeNull();
    const profileId = profile!.id;
    users.push(profileId);

    const { data: assignment } = await a
      .from("club_admin_assignments")
      .select("profile_id, club_id")
      .eq("profile_id", profileId)
      .eq("club_id", clubId)
      .maybeSingle();
    expect(assignment).not.toBeNull();

    // No club_memberships row for a club_admin invite.
    const { count: memberCount } = await a
      .from("club_memberships")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId);
    expect(memberCount).toBe(0);
  });
});
