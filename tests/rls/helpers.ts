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

// Full cleanup — wipes test users (cascades to profiles, memberships, admin
// assignments, consents) plus any test clubs created by seedClub.
export async function cleanup(userIds: string[], clubIds: string[] = []) {
  const a = admin();
  for (const id of userIds) {
    await a.auth.admin.deleteUser(id).catch(() => {});
  }
  for (const id of clubIds) {
    await a.from("clubs").delete().eq("id", id);
  }
}
