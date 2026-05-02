import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import { admin, cleanup, createTestUser, seedClub, signIn } from "./helpers";

// Phase 13 / 13-2b / Batch F2 — RLS integration coverage for the
// migration-044 soft-delete + anonymise-not-delete policies.
//
// Three state phases the policies must distinguish:
//   active        → deleted_at IS NULL                  → visible
//   grace window  → deleted_at set, PII intact          → HIDDEN (cross-user)
//   anonymised    → deleted_at set, first/last NULL     → visible
//
// The cross-user filter on profiles_club_admin_read +
// profiles_same_club_read uses (first_name IS NULL AND last_name
// IS NULL) as the anonymisation marker — defence-in-depth against
// the pg_cron flag (pending_auth_ban) being wrong. PII never leaks
// even if the cron job's flag-write races the column-NULL writes.
//
// Cleanup hazard: soft-deleted + anonymised test rows must be
// fully removed at afterAll. Batch B1a's hardened cleanup() handles
// the RESTRICT-FK descendants (t20_assessments, tournament_team_members)
// before issuing auth.admin.deleteUser, so cascade-via-auth-delete
// removes the profile regardless of soft-delete state. Each test's
// PII writes are wiped along with the user.

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

describe("RLS · profiles soft-delete cross-user read filter", () => {
  let clubId: string;

  beforeAll(async () => {
    clubId = await seedClub(`POPIA RLS ${randomUUID().slice(0, 6)}`);
    clubs.push(clubId);
  });

  it("self-read during grace window returns the row (own state visible)", async () => {
    const u = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(u.id);

    // Soft-delete the user (deleted_at set, PII intact).
    await admin()
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", u.id)
      .throwOnError();

    const { client } = await signIn(u);
    const { data, error } = await client
      .from("profiles")
      .select("id, first_name, deleted_at")
      .eq("id", u.id)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.id).toBe(u.id);
    expect(data?.deleted_at).not.toBeNull();
  }, 30_000);

  it("cross-user read during grace window returns zero rows (hidden)", async () => {
    const a = await createTestUser({ role: "player", clubIds: [clubId] });
    const b = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(a.id, b.id);

    // Soft-delete b with PII intact (grace window).
    await admin()
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", b.id)
      .throwOnError();

    const { client } = await signIn(a);
    const { data, error } = await client
      .from("profiles")
      .select("id")
      .eq("id", b.id)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  }, 30_000);

  it("cross-user read post-anonymisation returns the row (PII columns NULL)", async () => {
    const a = await createTestUser({ role: "player", clubIds: [clubId] });
    const b = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(a.id, b.id);

    // Anonymise b: deleted_at set, first/last NULL.
    await admin()
      .from("profiles")
      .update({
        deleted_at: new Date().toISOString(),
        first_name: null,
        last_name: null,
        display_name: null,
        email: null,
        phone: null,
        bsa_number: null,
      })
      .eq("id", b.id)
      .throwOnError();

    const { client } = await signIn(a);
    const { data, error } = await client
      .from("profiles")
      .select("id, first_name, last_name, deleted_at")
      .eq("id", b.id)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.id).toBe(b.id);
    expect(data?.first_name).toBeNull();
    expect(data?.last_name).toBeNull();
    expect(data?.deleted_at).not.toBeNull();
  }, 30_000);

  it("cross-user read on active user returns the row (sanity check active path)", async () => {
    const a = await createTestUser({ role: "player", clubIds: [clubId] });
    const b = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(a.id, b.id);

    const { client } = await signIn(a);
    const { data, error } = await client
      .from("profiles")
      .select("id, first_name, deleted_at")
      .eq("id", b.id)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.id).toBe(b.id);
    expect(data?.deleted_at).toBeNull();
  }, 30_000);
});

describe("RLS · profiles UPDATE policies for soft-delete", () => {
  let clubId: string;

  beforeAll(async () => {
    clubId = await seedClub(`POPIA UPDATE ${randomUUID().slice(0, 6)}`);
    clubs.push(clubId);
  });

  it("self can set deleted_at on own row", async () => {
    const u = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(u.id);

    const { client } = await signIn(u);
    const { error } = await client
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", u.id);

    expect(error).toBeNull();

    const { data } = await admin()
      .from("profiles")
      .select("deleted_at")
      .eq("id", u.id)
      .single();
    expect(data?.deleted_at).not.toBeNull();
  }, 30_000);

  it("self can reset deleted_at (restore-on-login path)", async () => {
    const u = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(u.id);

    // Pre-set deleted_at via service role.
    await admin()
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", u.id)
      .throwOnError();

    const { client } = await signIn(u);
    const { error } = await client
      .from("profiles")
      .update({ deleted_at: null })
      .eq("id", u.id);

    expect(error).toBeNull();

    const { data } = await admin()
      .from("profiles")
      .select("deleted_at")
      .eq("id", u.id)
      .single();
    expect(data?.deleted_at).toBeNull();
  }, 30_000);

  it("non-self UPDATE attempt on another user's deleted_at is denied (zero rows affected)", async () => {
    const a = await createTestUser({ role: "player", clubIds: [clubId] });
    const b = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(a.id, b.id);

    const { client } = await signIn(a);
    // PostgREST UPDATE that violates RLS doesn't error — it returns
    // zero rows. The data-level guarantee is the post-state of b.
    await client
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", b.id);

    const { data } = await admin()
      .from("profiles")
      .select("deleted_at")
      .eq("id", b.id)
      .single();
    expect(data?.deleted_at).toBeNull();
  }, 30_000);

  it("super_admin can set deleted_at on any profile (admin-driven deletion)", async () => {
    const sup = await createTestUser({ role: "super_admin", clubIds: [] });
    const target = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(sup.id, target.id);

    const { client } = await signIn(sup);
    const { error } = await client
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", target.id);

    expect(error).toBeNull();

    const { data } = await admin()
      .from("profiles")
      .select("deleted_at")
      .eq("id", target.id)
      .single();
    expect(data?.deleted_at).not.toBeNull();
  }, 30_000);
});

describe("RLS · anonymisation simulation + cross-user JOINs", () => {
  let clubId: string;
  let rubricId: string;

  beforeAll(async () => {
    clubId = await seedClub(`POPIA ANON ${randomUUID().slice(0, 6)}`);
    clubs.push(clubId);
    const { data, error } = await admin()
      .from("t20_rubric_versions")
      .select("id")
      .eq("is_active", true)
      .single();
    if (error || !data) throw new Error(`no active rubric: ${error?.message}`);
    rubricId = data.id;
  });

  it("anonymisation simulation flips cross-user visibility from hidden to visible (PII NULL)", async () => {
    const a = await createTestUser({ role: "player", clubIds: [clubId] });
    const b = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(a.id, b.id);

    // Phase 1: soft-delete b, PII intact → hidden from a's view.
    await admin()
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", b.id)
      .throwOnError();

    const { client } = await signIn(a);
    const before = await client
      .from("profiles")
      .select("id")
      .eq("id", b.id)
      .maybeSingle();
    expect(before.data).toBeNull();

    // Phase 2: simulate the pg_cron anonymise job — NULL the PII
    // columns (first_name, last_name, display_name, email, phone,
    // bsa_number, gender, date_of_birth, avatar_url) while
    // deleted_at remains set.
    await admin()
      .from("profiles")
      .update({
        first_name: null,
        last_name: null,
        display_name: null,
        email: null,
        phone: null,
        bsa_number: null,
        gender: null,
        date_of_birth: null,
        avatar_url: null,
      })
      .eq("id", b.id)
      .throwOnError();

    const after = await client
      .from("profiles")
      .select("id, first_name, last_name, email, bsa_number")
      .eq("id", b.id)
      .maybeSingle();
    expect(after.data).not.toBeNull();
    expect(after.data?.first_name).toBeNull();
    expect(after.data?.last_name).toBeNull();
    expect(after.data?.email).toBeNull();
    expect(after.data?.bsa_number).toBeNull();
  }, 30_000);

  it("t20_assessments JOIN — anonymised assessor's profile resolves through the embed", async () => {
    const player = await createTestUser({ role: "player", clubIds: [clubId] });
    const assessor = await createTestUser({
      role: "club_admin",
      clubIds: [clubId],
    });
    users.push(player.id, assessor.id);

    // The cross-user read policy (profiles_same_club_read) requires
    // co-membership via club_memberships. createTestUser inserts the
    // club_admin into club_admin_assignments but NOT club_memberships
    // — meaning a player can't read the admin's profile via the
    // embed by default. Real-world clubs often have admins who are
    // also playing members; seed the additional row so the JOIN test
    // exercises the soft-delete filter rather than the unrelated
    // role-policy boundary.
    await admin()
      .from("club_memberships")
      .insert({ profile_id: assessor.id, club_id: clubId, status: "active" })
      .throwOnError();

    // Seed a draft assessment + then anonymise the assessor.
    const { data: ass } = await admin()
      .from("t20_assessments")
      .insert({
        club_id: clubId,
        profile_id: player.id,
        assessor_id: assessor.id,
        rubric_version_id: rubricId,
      })
      .select("id")
      .single()
      .throwOnError();
    const assessmentId = ass!.id;

    // Anonymise the assessor.
    await admin()
      .from("profiles")
      .update({
        deleted_at: new Date().toISOString(),
        first_name: null,
        last_name: null,
        display_name: null,
        email: null,
        phone: null,
        bsa_number: null,
      })
      .eq("id", assessor.id)
      .throwOnError();

    // Player reads the assessment + embeds the assessor profile.
    // The embed should return the anonymised row (PII NULL).
    const { client } = await signIn(player);
    const { data, error } = await client
      .from("t20_assessments")
      .select(
        "id, assessor:profiles!assessor_id(id, first_name, last_name, deleted_at)",
      )
      .eq("id", assessmentId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const a = data?.assessor as
      | {
          id: string;
          first_name: string | null;
          last_name: string | null;
          deleted_at: string | null;
        }
      | null;
    expect(a).not.toBeNull();
    expect(a?.id).toBe(assessor.id);
    expect(a?.first_name).toBeNull();
    expect(a?.last_name).toBeNull();
    expect(a?.deleted_at).not.toBeNull();
  }, 30_000);

  it("tournament_team_members JOIN — anonymised member's profile resolves through the embed", async () => {
    const captain = await createTestUser({
      role: "player",
      clubIds: [clubId],
    });
    const teammate = await createTestUser({
      role: "player",
      clubIds: [clubId],
    });
    users.push(captain.id, teammate.id);

    // Seed tournament + team + members.
    const { data: tournament } = await admin()
      .from("tournaments")
      .insert({
        host_club_id: clubId,
        name: "POPIA Anon Tournament",
        format: "singles",
        scope: "club",
        structure: "knockout",
        seeding_method: "random",
        handicap_rule: "scratch",
        category: "open",
        age_group: "open",
        starts_at: new Date(Date.now() + 86_400_000).toISOString(),
        ends_at: new Date(Date.now() + 172_800_000).toISOString(),
        status: "open",
      })
      .select("id")
      .single()
      .throwOnError();
    const { data: team } = await admin()
      .from("tournament_teams")
      .insert({
        tournament_id: tournament!.id,
        club_id: clubId,
        name: "Test Team",
        seed: 1,
      })
      .select("id")
      .single()
      .throwOnError();
    await admin()
      .from("tournament_team_members")
      .insert([
        { team_id: team!.id, profile_id: captain.id, position: "skip" },
        { team_id: team!.id, profile_id: teammate.id, position: "lead" },
      ])
      .throwOnError();

    // Anonymise teammate.
    await admin()
      .from("profiles")
      .update({
        deleted_at: new Date().toISOString(),
        first_name: null,
        last_name: null,
        display_name: null,
        email: null,
        phone: null,
        bsa_number: null,
      })
      .eq("id", teammate.id)
      .throwOnError();

    // Captain reads the team_members + embeds profiles.
    const { client } = await signIn(captain);
    const { data, error } = await client
      .from("tournament_team_members")
      .select("id, profile_id, profile:profiles!profile_id(id, first_name)")
      .eq("team_id", team!.id);

    expect(error).toBeNull();
    expect(data?.length).toBe(2);
    type Row = {
      id: string;
      profile_id: string;
      profile: { id: string; first_name: string | null } | null;
    };
    const rows = data as Row[];
    const teammateRow = rows.find((r) => r.profile_id === teammate.id);
    expect(teammateRow).not.toBeUndefined();
    expect(teammateRow?.profile?.first_name).toBeNull();
    expect(teammateRow?.profile?.id).toBe(teammate.id);
  }, 30_000);

  it("club_memberships visibility — soft-deleted member's membership row stays visible to club admin", async () => {
    const ca = await createTestUser({
      role: "club_admin",
      clubIds: [clubId],
    });
    const member = await createTestUser({
      role: "player",
      clubIds: [clubId],
    });
    users.push(ca.id, member.id);

    // Soft-delete the member (grace window — PII intact).
    await admin()
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", member.id)
      .throwOnError();

    // Club admin lists memberships for the club.
    const { client } = await signIn(ca);
    const { data, error } = await client
      .from("club_memberships")
      .select("id, profile_id")
      .eq("club_id", clubId);

    expect(error).toBeNull();
    // Both ca's own membership-via-admin-assignment isn't a
    // club_memberships row (admins use club_admin_assignments);
    // member's is. Confirm the soft-deleted member's row is still
    // visible (audit-trail continuity per the locked decision).
    const memberRow = data?.find((r) => r.profile_id === member.id);
    expect(memberRow).not.toBeUndefined();
  }, 30_000);
});
