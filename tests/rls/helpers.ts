import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Database } from "@/types/database.types";

type Role = "super_admin" | "club_admin" | "player";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!URL || !ANON || !SERVICE) {
  throw new Error(
    "tests/rls/helpers.ts: missing env — did vitest.rls.config.ts load .env.test?",
  );
}

export function admin(): SupabaseClient<Database> {
  return createClient<Database>(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function anon(): SupabaseClient<Database> {
  return createClient<Database>(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type TestUser = {
  id: string;
  email: string;
  password: string;
  role: Role;
};

export type TestSession = {
  client: SupabaseClient<Database>;
  token: string;
  jwt: JwtPayload;
};

export type JwtPayload = {
  sub: string;
  app_metadata: { role?: string; club_ids?: string[] } & Record<string, unknown>;
} & Record<string, unknown>;

// Decode a JWT payload (no signature verification — we trust the local stack).
export function decodeJwt(token: string): JwtPayload {
  return JSON.parse(
    Buffer.from(token.split(".")[1], "base64url").toString(),
  ) as JwtPayload;
}

// Create a user via the admin API, update the profile to the requested role,
// optionally seed club memberships / admin assignments. Returns credentials.
export async function createTestUser(opts: {
  role: Role;
  clubIds?: string[];
  email?: string;
}): Promise<TestUser> {
  const a = admin();
  const email = opts.email ?? `rls-${randomUUID()}@test.handibowls.local`;
  const password = "Test-Password-1!";

  const { data, error } = await a.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createUser failed: ${error?.message ?? "no user"}`);
  }
  const id = data.user.id;

  const { error: upErr } = await a
    .from("profiles")
    .update({ role: opts.role, first_name: "RLS", last_name: opts.role })
    .eq("id", id);
  if (upErr) throw new Error(`profile update failed: ${upErr.message}`);

  for (const clubId of opts.clubIds ?? []) {
    if (opts.role === "club_admin") {
      const { error: e } = await a
        .from("club_admin_assignments")
        .insert({ profile_id: id, club_id: clubId });
      if (e) throw new Error(`club_admin_assignments: ${e.message}`);
    } else {
      const { error: e } = await a
        .from("club_memberships")
        .insert({ profile_id: id, club_id: clubId, status: "active" });
      if (e) throw new Error(`club_memberships: ${e.message}`);
    }
  }

  return { id, email, password, role: opts.role };
}

// Sign in and return the client + decoded JWT. The JWT claims are authoritative
// for RLS — supabase-js user.app_metadata is NOT refreshed from the token, so
// asserting on the decoded JWT is what you want.
export async function signIn(user: TestUser): Promise<TestSession> {
  const client = createClient<Database>(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error || !data.session) {
    throw new Error(`signIn failed: ${error?.message ?? "no session"}`);
  }
  return {
    client,
    token: data.session.access_token,
    jwt: decodeJwt(data.session.access_token),
  };
}

// Seed a demo club (unique slug so parallel files don't collide) and return id.
export async function seedClub(name = "Test Club"): Promise<string> {
  const a = admin();
  const { data: districts } = await a
    .from("districts")
    .select("id")
    .limit(1)
    .throwOnError();
  if (!districts?.length) throw new Error("no districts seeded");
  const { data, error } = await a
    .from("clubs")
    .insert({
      name,
      slug: `test-${randomUUID()}`,
      district_id: districts[0].id,
      city: "Testville",
      theme_preset: "atomic-red",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`seedClub: ${error?.message}`);
  return data.id;
}

// Full cleanup — wipes test users + test clubs and every documented
// ON DELETE RESTRICT child row that would otherwise block teardown.
//
// Phase 13 / 13-2 / Batch B1a — DRIFT-L66 hardening.
// Pre-hardening, cleanup() did:
//   for (id in userIds) deleteUser(id).catch(()=>{})
//   for (id in clubIds) clubs.delete().eq("id", id)
// When a test crashed mid-run with a booking / t20_assessment /
// tournament_entry / tournament_team_member already inserted, the
// cascade behind deleteUser silently failed (RESTRICT FK) and the
// catch-less `clubs.delete()` returned an error that nobody read.
// Result: orphan rows in the cloud DB at `test-...` clubs (4 such
// orphans were observed at Phase 8e Finding 18 diagnosis).
//
// Documented ON DELETE RESTRICT relationships in the test seed surface:
//   ── blocking club delete (FK → clubs.id) ──
//     bookings.club_id           (006)
//     t20_assessments.club_id    (007)
//     tournaments.host_club_id   (005)   cascades children when removed
//     tournament_entries.club_id (005)   also cascade-deleted by tournaments
//   ── blocking profile delete (FK → profiles.id) ──
//     t20_assessments.profile_id     (007)
//     t20_assessments.assessor_id    (007)
//     tournament_team_members.profile_id (005)
//     tournament_entries.profile_id is ON DELETE SET NULL — safe.
//
// Teardown order:
//   1. Delete RESTRICT children of the test clubs (assessments,
//      bookings, tournaments). `tournaments` cascade covers
//      tournament_entries / tournament_teams / matches /
//      tournament_team_members / tournament_greens for that
//      tournament's club scope.
//   2. Delete RESTRICT children of the test users that survived
//      step 1 (e.g. an assessor with rows at non-test clubs;
//      tournament_team_members in non-test tournaments).
//   3. auth.admin.deleteUser → cascades profiles + memberships +
//      admin assignments + consents + audit_log + notifications +
//      messages + message_recipients.
//   4. Delete the test clubs — now unblocked.
//
// Errors from the dependency-row deletes are surfaced to the
// console (instead of swallowed) so a future RESTRICT we missed
// surfaces visibly in CI rather than silently leaks orphans.
export async function cleanup(userIds: string[], clubIds: string[] = []) {
  const a = admin();

  // Step 1 — RESTRICT children of test clubs.
  if (clubIds.length > 0) {
    await deleteOrLog(
      a.from("t20_assessments").delete().in("club_id", clubIds),
      "t20_assessments by club_id",
    );
    await deleteOrLog(
      a.from("bookings").delete().in("club_id", clubIds),
      "bookings by club_id",
    );
    // tournaments cascades: tournament_entries, tournament_teams,
    // tournament_team_members, matches, match_ends, tournament_greens.
    await deleteOrLog(
      a.from("tournaments").delete().in("host_club_id", clubIds),
      "tournaments by host_club_id",
    );
  }

  // Step 2 — RESTRICT children of test users that survived step 1.
  // (e.g. an assessor on a non-test club's assessment, a member of a
  // non-test tournament's team.)
  if (userIds.length > 0) {
    // t20_assessments via profile_id OR assessor_id — Supabase JS
    // doesn't support OR across `.in()`, so two passes.
    await deleteOrLog(
      a.from("t20_assessments").delete().in("profile_id", userIds),
      "t20_assessments by profile_id",
    );
    await deleteOrLog(
      a.from("t20_assessments").delete().in("assessor_id", userIds),
      "t20_assessments by assessor_id",
    );
    await deleteOrLog(
      a.from("tournament_team_members").delete().in("profile_id", userIds),
      "tournament_team_members by profile_id",
    );
  }

  // Step 3 — delete users (cascades profiles + downstream cascade FKs).
  for (const id of userIds) {
    await a.auth.admin.deleteUser(id).catch(() => {});
  }

  // Step 4 — delete test clubs (now unblocked).
  for (const id of clubIds) {
    const { error } = await a.from("clubs").delete().eq("id", id);
    if (error) {
      // Surface the failure — orphan-leak class-of-bug regression.
      console.error(`cleanup: club delete failed for ${id}: ${error.message}`);
    }
  }
}

async function deleteOrLog(
  query: PromiseLike<{ error: { message: string } | null }>,
  label: string,
) {
  const { error } = await query;
  if (error) {
    console.error(`cleanup: delete ${label} failed: ${error.message}`);
  }
}
