import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../types/database.types";

// Closes the partial-close on Phase-5 DOD item 3:
// "Returning player with profile_completed=true skips /me/setup."
//
// Drives a fresh test player into a fully-completed profile state via
// service-role, then verifies that signing in + navigating to /play does
// NOT bounce through /me/setup. Also verifies that a direct /me/setup
// visit by a completed player redirects to /play (the wizard's own
// returning-visitor short-circuit at app/(player)/me/setup/page.tsx).

const RUN_ID = `${Date.now()}`;
const PLAYER_EMAIL = `phase5-skip-${RUN_ID}@handibowls.test`;
const PLAYER_PASSWORD = "phase5-skip-password-12345";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function adminClient() {
  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY missing — copy .env.test values into your shell or use dotenv-cli.",
    );
  }
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function teardown() {
  const admin = adminClient();
  const { data } = await admin.auth.admin.listUsers();
  for (const user of data?.users ?? []) {
    if (user.email === PLAYER_EMAIL) {
      await admin.auth.admin.deleteUser(user.id);
    }
  }
}

async function getDemoClubId(): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("clubs")
    .select("id")
    .eq("slug", "demo-bowls-club")
    .single();
  if (error || !data) throw new Error(`Demo club lookup failed: ${error?.message}`);
  return data.id;
}

test.beforeEach(teardown);
test.afterEach(teardown);

test("phase-5: returning player with profile_completed=true skips /me/setup", async ({
  page,
}) => {
  const admin = adminClient();
  const demoClubId = await getDemoClubId();

  // Setup: create the test player fully-completed --------------------------
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: PLAYER_EMAIL,
    password: PLAYER_PASSWORD,
    email_confirm: true,
  });
  expect(createErr, "createUser should succeed").toBeNull();
  const userId = created!.user!.id;

  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      first_name: "Returning",
      last_name: "Player",
      gender: "female",
      date_of_birth: "1990-05-15",
      dominant_hand: "right",
      profile_completed: true,
      novice_registered_at: new Date().toISOString().slice(0, 10),
    })
    .eq("id", userId);
  expect(profileErr, "profile completion update should succeed").toBeNull();

  const { error: membershipErr } = await admin.from("club_memberships").insert({
    profile_id: userId,
    club_id: demoClubId,
    is_primary: true,
    status: "active",
    club_grading: "lead",
  });
  expect(membershipErr, "membership insert should succeed").toBeNull();

  // 1. Sign in — homeFor('player') redirects to /play -----------------------
  await page.goto("/login");
  await page.getByLabel("Email").fill(PLAYER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PLAYER_PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/play/, { timeout: 30_000 });

  // 2. URL must NOT bounce to /me/setup. Wait briefly to give any
  //    erroneous redirect a chance to fire — networkidle settles after the
  //    /play render's RSC requests complete.
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
  expect(page.url()).toMatch(/\/play$/);
  expect(page.url()).not.toContain("/me/setup");

  // 3. Direct visit to /me/setup also redirects to /play, per the page's
  //    returning-visitor short-circuit.
  await page.goto("/me/setup");
  await page.waitForURL(/\/play/, { timeout: 30_000 });
  expect(page.url()).toMatch(/\/play$/);

  // 4. Sanity: the player IS signed in (NoviceBadge is visible because
  //    novice_registered_at is set).
  await expect(page.getByTestId("novice-badge")).toBeVisible({ timeout: 10_000 });
});
