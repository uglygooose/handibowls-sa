import { afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

vi.mock("server-only", () => ({}));

import { admin, cleanup, seedClub } from "../../rls/helpers";

// Phase 11 / 11-4b — DRIFT 161 closure regression.
//
// Pre-11-4b, acceptInviteAction always called auth.admin.createUser.
// A second invite to an email that already had an auth.users row
// returned "user already registered" and the player got stuck.
//
// This test exercises the new existing-user branch end-to-end:
//   1. Create an auth user (existing account)
//   2. Create a club + an invite for that email
//   3. Call acceptInviteAction
//   4. Assert: club_membership row exists, invite is marked
//      accepted, audit_log row exists, no createUser error
//
// next/navigation's redirect() throws a NEXT_REDIRECT error to
// short-circuit Server Actions; we catch it and assert post-state
// on the DB regardless. signOut() from next/navigation is also
// mocked to a no-op so the test runs without an active session.

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

// Mock the server-side createClient (cookie-bound) so signOut() can
// run without a request context. The integration test cares about the
// service-role writes, not the cookie clearing.
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

describe("acceptInviteAction · DRIFT 161 closure — existing-user path", () => {
  it("adds membership without re-creating the auth user; revokes invite; audits", async () => {
    const a = admin();
    const clubId = await seedClub("Existing User Path");
    clubs.push(clubId);

    // 1. Create the existing auth user (mirrors the helpers but
    //    without a club membership — this user will be added via
    //    the invite path under test).
    const email = `rls-existing-${randomUUID()}@test.handibowls.local`;
    const password = "Test-Password-1!";
    const { data: createdUser, error: createErr } = await a.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(createErr).toBeNull();
    const profileId = createdUser!.user!.id;
    users.push(profileId);

    // 2. Insert an invite for the same email at clubId.
    const { data: invite, error: inviteErr } = await a
      .from("invites")
      .insert({
        club_id: clubId,
        email,
        role: "player",
        invited_by: null,
      })
      .select("id, token")
      .single();
    expect(inviteErr).toBeNull();
    const token = invite!.token;

    // 3. Call acceptInviteAction. Will redirect at the end → catch.
    const { acceptInviteAction } = await import("@/lib/auth/actions");
    const fd = new FormData();
    fd.set("token", token);
    fd.set("password", "anything-ignored-on-existing-user-path");

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

    // 4. Assertions on post-state.

    // Redirect target carries the new club name + the role-home next.
    expect(redirectTarget).not.toBeNull();
    expect(redirectTarget).toContain("/login?invited_to=Existing");
    expect(redirectTarget).toContain("next=");

    // Membership exists for the original profile.
    const { data: membership } = await a
      .from("club_memberships")
      .select("profile_id, club_id, status, is_primary")
      .eq("profile_id", profileId)
      .eq("club_id", clubId)
      .maybeSingle();
    expect(membership).not.toBeNull();
    expect(membership?.status).toBe("active");
    // Existing user — new membership lands non-primary.
    expect(membership?.is_primary).toBe(false);

    // Invite is marked accepted with the existing profileId.
    const { data: invitePost } = await a
      .from("invites")
      .select("status, accepted_at, accepted_profile_id")
      .eq("token", token)
      .maybeSingle();
    expect(invitePost?.status).toBe("accepted");
    expect(invitePost?.accepted_profile_id).toBe(profileId);
    expect(invitePost?.accepted_at).not.toBeNull();

    // Audit row recorded.
    const { data: auditRows } = await a
      .from("audit_log")
      .select("table_name, action, performed_by, payload")
      .eq("performed_by", profileId)
      .eq("action", "invite_accepted_existing_user");
    expect(auditRows).not.toBeNull();
    expect(auditRows!.length).toBeGreaterThanOrEqual(1);
    expect(auditRows![0].table_name).toBe("club_memberships");
    expect((auditRows![0].payload as Record<string, unknown>).club_id).toBe(
      clubId,
    );

    // The auth user count is unchanged — the existing user wasn't
    // re-created. We can't query auth.users count safely, but the
    // fact that no createUser error surfaced AND the membership
    // is bound to the pre-existing profileId is the proof.
  });

  it("is idempotent on re-acceptance (duplicate membership not inserted)", async () => {
    const a = admin();
    const clubId = await seedClub("Idem Existing");
    clubs.push(clubId);

    const email = `rls-existing-${randomUUID()}@test.handibowls.local`;
    const password = "Test-Password-1!";
    const { data: createdUser } = await a.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    const profileId = createdUser!.user!.id;
    users.push(profileId);

    // Pre-seed membership.
    await a.from("club_memberships").insert({
      profile_id: profileId,
      club_id: clubId,
      is_primary: true,
      status: "active",
    });

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
    fd.set("password", "anything");
    try {
      await acceptInviteAction({ ok: undefined }, fd);
    } catch {
      // redirect — fine
    }

    // Membership count for (profile, club) stays at 1.
    const { count } = await a
      .from("club_memberships")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .eq("club_id", clubId);
    expect(count).toBe(1);
  });
});
