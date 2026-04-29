// Seeds three canonical dev users against the local Supabase stack:
//   super@handibowls.local  → super_admin, no club
//   admin@demo.local        → club_admin at Demo Bowls Club
//   player@demo.local       → player, member of Demo Bowls Club
//
// Idempotent: re-running upserts the auth user and ensures the profile +
// membership rows exist with the expected shape. Uses the service-role key
// to skip RLS; never run against production.
//
// Usage:
//   cp .env.test.example .env.test  # fills in local keys from `supabase status`
//   npm run seed:dev

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { Database } from "../types/database.types";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Local .env.test loader. The seed script runs outside Next so we can't rely
// on Next's env loading. Mirrors vitest.rls.config.ts' parser.
function loadEnv() {
  const envPath = resolve(__dirname, "..", ".env.test");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

loadEnv();

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY missing. Run `npx supabase status` and populate .env.test.",
  );
  process.exit(1);
}

const DEV_PASSWORD = "dev-password-12345";
const DEMO_CLUB_SLUG = "demo-bowls-club";

type Role = Database["public"]["Enums"]["user_role"];

type SeedUser = {
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  displayName: string;
  clubSlug: string | null; // null = no club (super_admin)
  isPrimary: boolean;
};

const USERS: SeedUser[] = [
  {
    email: "super@handibowls.local",
    role: "super_admin",
    firstName: "Sally",
    lastName: "Super",
    displayName: "Super Admin",
    clubSlug: null,
    isPrimary: false,
  },
  {
    email: "admin@demo.local",
    role: "club_admin",
    firstName: "Alex",
    lastName: "Admin",
    displayName: "Club Admin",
    clubSlug: DEMO_CLUB_SLUG,
    isPrimary: false,
  },
  {
    email: "player@demo.local",
    role: "player",
    firstName: "Pat",
    lastName: "Player",
    displayName: "Pat Player",
    clubSlug: DEMO_CLUB_SLUG,
    isPrimary: true,
  },
];

async function run() {
  const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // The admin.auth.admin.listUsers API is paginated; the dev dataset has <100
  // accounts so one page suffices. Bump perPage or switch to getUserByEmail
  // (newer supabase-js) if the demo dataset grows.
  async function findUserId(email: string): Promise<string | null> {
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw error;
    return (
      data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ??
      null
    );
  }

  async function ensureAuthUser(user: SeedUser): Promise<string> {
    const existing = await findUserId(user.email);
    if (existing) {
      await admin.auth.admin.updateUserById(existing, {
        password: DEV_PASSWORD,
        email_confirm: true,
      });
      return existing;
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: user.email,
      password: DEV_PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error("createUser returned no user");
    return data.user.id;
  }

  const { data: club, error: clubError } = await admin
    .from("clubs")
    .select("id")
    .eq("slug", DEMO_CLUB_SLUG)
    .maybeSingle();
  if (clubError) throw clubError;
  if (!club) throw new Error(`Club not found: ${DEMO_CLUB_SLUG}`);
  const demoClubId = club.id;

  await ensureGreensAndRinks(admin, demoClubId);

  for (const user of USERS) {
    const id = await ensureAuthUser(user);

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        role: user.role,
        first_name: user.firstName,
        last_name: user.lastName,
        display_name: user.displayName,
        email: user.email,
        profile_completed: true,
      })
      .eq("id", id);
    if (profileError) throw profileError;

    if (user.clubSlug && user.role === "club_admin") {
      const { error: upsertError } = await admin
        .from("club_admin_assignments")
        .upsert(
          { profile_id: id, club_id: demoClubId },
          { onConflict: "profile_id,club_id" },
        );
      if (upsertError) throw upsertError;
    } else if (user.clubSlug && user.role === "player") {
      const { error: upsertError } = await admin
        .from("club_memberships")
        .upsert(
          {
            profile_id: id,
            club_id: demoClubId,
            is_primary: user.isPrimary,
            status: "active",
          },
          { onConflict: "profile_id,club_id" },
        );
      if (upsertError) throw upsertError;
    }

    console.log(`seeded ${user.email} (${user.role})`);
  }

  console.log(`\nAll three users share the password: ${DEV_PASSWORD}`);
}

// Demo Bowls Club booking topology — 2 greens × 5 rinks total. Names
// chosen to mirror the design source's bookingSlots example data
// (handibowls/project/player-data.js:106-114), not from a design spec
// naming the club's canonical topology — flagging here so a future
// rename against actual club records doesn't surprise anyone.
//
// Idempotent via the unique constraints (greens.club_id+name,
// rinks.green_id+number). Re-running upserts; no orphans, no dupes.
async function ensureGreensAndRinks(
  admin: ReturnType<typeof createClient<Database>>,
  clubId: string,
) {
  const greens: Array<{ name: string; rink_count: number; rinks: number[] }> = [
    { name: "Main", rink_count: 3, rinks: [1, 2, 3] },
    { name: "South", rink_count: 2, rinks: [1, 2] },
  ];

  for (const green of greens) {
    const { data: greenRow, error: greenErr } = await admin
      .from("greens")
      .upsert(
        {
          club_id: clubId,
          name: green.name,
          rink_count: green.rink_count,
          active: true,
        },
        { onConflict: "club_id,name" },
      )
      .select("id")
      .single();
    if (greenErr) throw greenErr;

    const rinkRows = green.rinks.map((number) => ({
      green_id: greenRow.id,
      number,
      active: true,
    }));
    const { error: rinkErr } = await admin
      .from("rinks")
      .upsert(rinkRows, { onConflict: "green_id,number" });
    if (rinkErr) throw rinkErr;

    console.log(
      `seeded green ${green.name} (${green.rinks.length} rink${green.rinks.length === 1 ? "" : "s"})`,
    );
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
