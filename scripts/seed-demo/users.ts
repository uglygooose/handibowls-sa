// Phase 13 / 13-8 / Batch A — Demo seed users (7 canonical accounts).
//
// Roster:
//   super@handibowls.local   → super_admin (no club)
//   admin@demo.local         → club_admin at Demo Bowls Club
//   admin2@demo.local        → club_admin at Pinelands BC (cross-club demo)
//   coach@demo.local         → club_admin at Demo Bowls Club (T20 capture demo)
//   captain@demo.local       → player at Demo Bowls Club (captain demo)
//   player@demo.local        → player at Demo Bowls Club (primary)
//   player2@demo.local       → player at Demo Bowls Club (opposing-captain demo)
//
// All 7 share the password `DemoPass2026!` (see scripts/seed-demo/_lib.ts).
//
// Auth-user creation pattern mirrors scripts/seed-dev-users.ts:
// listUsers + filter + create-or-update. The reset script wipes all
// matching auth users first, so re-running this against a clean
// reset always hits the create-path; the update-path covers re-runs
// without reset (operator running `seed:demo --skip-reset`).

import {
  DEMO_PASSWORD,
  findUserId,
  logSection,
  type Admin,
} from "./_lib";
import type { Database } from "../../types/database.types";

type Role = Database["public"]["Enums"]["user_role"];

export type SeedUser = {
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  displayName: string;
  // Logical role hint for fixtures in commit 2 (T20 coach, tournament
  // captain). NOT stored as a column — derived for downstream
  // fixture modules to find the right account.
  hint?: "coach" | "captain" | "opposing-captain" | "primary-player";
};

// Filler members (Phase 13 / 13-8 / Batch A / Commit 2). Reach the
// operator-locked 10 functional members at Demo Bowls Club + 2
// players at Pinelands BC for the cross-club in-progress tournament.
// These are NOT inflation — they're the minimum to populate
// tournament-team rosters with realistic role + position diversity.
export type FillerSpec = {
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  clubSlug: "demo-bowls-club" | "pinelands-bc";
  position?: "skip" | "third" | "second" | "lead";
};

export const FILLER_MEMBERS: FillerSpec[] = [
  // 5 fillers at Demo Bowls Club. Position hints map to BSA team
  // positions; tournament-team seeding uses these to fill rosters
  // believably (skip leads, lead plays first, etc.).
  {
    email: "vee@demo.local",
    firstName: "Vee",
    lastName: "Veteran",
    displayName: "Vee Veteran",
    clubSlug: "demo-bowls-club",
    position: "skip",
  },
  {
    email: "tee@demo.local",
    firstName: "Tee",
    lastName: "Third",
    displayName: "Tee Third",
    clubSlug: "demo-bowls-club",
    position: "third",
  },
  {
    email: "ess@demo.local",
    firstName: "Ess",
    lastName: "Second",
    displayName: "Ess Second",
    clubSlug: "demo-bowls-club",
    position: "second",
  },
  {
    email: "lee@demo.local",
    firstName: "Lee",
    lastName: "Lead",
    displayName: "Lee Lead",
    clubSlug: "demo-bowls-club",
    position: "lead",
  },
  {
    email: "ren@demo.local",
    firstName: "Ren",
    lastName: "Rookie",
    displayName: "Ren Rookie",
    clubSlug: "demo-bowls-club",
    position: "lead",
  },
  // 2 players at Pinelands BC for the in-progress cross-club
  // tournament. Minimum to populate 1 team + 1 opposing team.
  {
    email: "pinplay1@demo.local",
    firstName: "Penny",
    lastName: "Pines",
    displayName: "Penny Pines",
    clubSlug: "pinelands-bc",
    position: "skip",
  },
  {
    email: "pinplay2@demo.local",
    firstName: "Pat",
    lastName: "Pinetree",
    displayName: "Pat Pinetree",
    clubSlug: "pinelands-bc",
    position: "lead",
  },
];

export type SeededFiller = FillerSpec & { id: string };

export async function seedFillerMembers(
  client: Admin,
): Promise<SeededFiller[]> {
  logSection("Demo seed — filler member auth users + profiles");

  const out: SeededFiller[] = [];
  for (const f of FILLER_MEMBERS) {
    const id = await ensureFillerAuthUser(client, f);
    const { error: profileErr } = await client
      .from("profiles")
      .update({
        role: "player",
        first_name: f.firstName,
        last_name: f.lastName,
        display_name: f.displayName,
        email: f.email,
        profile_completed: true,
      })
      .eq("id", id);
    if (profileErr) throw profileErr;
    out.push({ ...f, id });
    console.log(
      `  ${f.email.padEnd(28)} player       ${f.displayName} (${f.clubSlug})`,
    );
  }
  console.log(
    `\n  Seeded ${out.length} filler member(s). Shared password: ${DEMO_PASSWORD}`,
  );
  return out;
}

async function ensureFillerAuthUser(
  client: Admin,
  f: FillerSpec,
): Promise<string> {
  const existing = await findUserId(client, f.email);
  if (existing) {
    const { error } = await client.auth.admin.updateUserById(existing, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    return existing;
  }
  const { data, error } = await client.auth.admin.createUser({
    email: f.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  return data.user.id;
}

export const SEED_USERS: SeedUser[] = [
  {
    email: "super@handibowls.local",
    role: "super_admin",
    firstName: "Sally",
    lastName: "Super",
    displayName: "Sally Super",
  },
  {
    email: "admin@demo.local",
    role: "club_admin",
    firstName: "Alex",
    lastName: "Admin",
    displayName: "Alex Admin",
  },
  {
    email: "admin2@demo.local",
    role: "club_admin",
    firstName: "Mo",
    lastName: "Manager",
    displayName: "Mo Manager",
  },
  {
    email: "coach@demo.local",
    role: "club_admin",
    firstName: "Casey",
    lastName: "Coach",
    displayName: "Casey Coach",
    hint: "coach",
  },
  {
    email: "captain@demo.local",
    role: "player",
    firstName: "Cam",
    lastName: "Captain",
    displayName: "Cam Captain",
    hint: "captain",
  },
  {
    email: "player@demo.local",
    role: "player",
    firstName: "Pat",
    lastName: "Player",
    displayName: "Pat Player",
    hint: "primary-player",
  },
  {
    email: "player2@demo.local",
    role: "player",
    firstName: "Pippa",
    lastName: "Player",
    displayName: "Pippa Player",
    hint: "opposing-captain",
  },
];

export type SeededUser = SeedUser & { id: string };

export async function seedUsers(client: Admin): Promise<SeededUser[]> {
  logSection("Demo seed — auth users + profiles");

  const seeded: SeededUser[] = [];
  for (const u of SEED_USERS) {
    const id = await ensureAuthUser(client, u);

    const { error: profileErr } = await client
      .from("profiles")
      .update({
        role: u.role,
        first_name: u.firstName,
        last_name: u.lastName,
        display_name: u.displayName,
        email: u.email,
        profile_completed: true,
      })
      .eq("id", id);
    if (profileErr) throw profileErr;

    seeded.push({ ...u, id });
    console.log(`  ${u.email.padEnd(32)} ${u.role.padEnd(12)} ${u.displayName}`);
  }

  console.log(
    `\n  Seeded ${seeded.length} demo users. Shared password: ${DEMO_PASSWORD}`,
  );
  return seeded;
}

async function ensureAuthUser(
  client: Admin,
  user: SeedUser,
): Promise<string> {
  const existing = await findUserId(client, user.email);
  if (existing) {
    const { error } = await client.auth.admin.updateUserById(existing, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    return existing;
  }
  const { data, error } = await client.auth.admin.createUser({
    email: user.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  return data.user.id;
}
