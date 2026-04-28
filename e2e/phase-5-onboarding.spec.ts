import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../types/database.types";

// End-to-end Phase-5 onboarding. The full §8 flow:
//   1. club_admin invites a player via /manage/members → dev banner URL
//   2. player accepts via /invite/[token]; profile_completed gate sends
//      them to /me/setup
//   3. player walks the 4-step wizard → lands on /play
//   4. NoviceBadge renders in the TopBar (within 3y novice window)
//   5. Service-role attaches the same player to a second club
//   6. ClubSwitcher appears in the TopBar (memberships >= 2)
//   7. Switching primary via the dropdown updates the trigger label
//
// Service-role admin client used for setup + teardown so re-runs are
// idempotent. Uses the seed admin@demo.local (Demo Bowls Club admin)
// + a freshly-generated player email so concurrent runs never collide.

const ADMIN_EMAIL = "admin@demo.local";
const DEV_PASSWORD = "dev-password-12345";

// Per-run unique email so re-runs and concurrent suites don't trip each
// other. Auth.users has a unique email constraint so a stale row from a
// previous failed run would block new invites at the same address.
const PLAYER_EMAIL = `phase5-test-${Date.now()}@handibowls.test`;
const PLAYER_PASSWORD = "phase5-test-password-12345";

const TEST_CLUB_SLUG = "phase5-test-club";
const TEST_CLUB_NAME = "Phase 5 Test Club";

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

async function teardownPlayer() {
  const admin = adminClient();
  // Delete any pending invites for this email (memberships cascade with the
  // user delete below).
  await admin.from("invites").delete().eq("email", PLAYER_EMAIL);
  // Find + delete the auth user created by the invite-accept flow. Cascades
  // to profiles, club_memberships, consents.
  const { data } = await admin.auth.admin.listUsers();
  for (const user of data?.users ?? []) {
    if (user.email === PLAYER_EMAIL) {
      await admin.auth.admin.deleteUser(user.id);
    }
  }
}

async function ensureTestClub(): Promise<string> {
  const admin = adminClient();
  const { data: existing } = await admin
    .from("clubs")
    .select("id")
    .eq("slug", TEST_CLUB_SLUG)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: district, error: districtErr } = await admin
    .from("districts")
    .select("id")
    .eq("name", "Johannesburg")
    .single();
  if (districtErr || !district) throw new Error(`District lookup failed: ${districtErr?.message}`);
  const { data: created, error: createErr } = await admin
    .from("clubs")
    .insert({
      name: TEST_CLUB_NAME,
      slug: TEST_CLUB_SLUG,
      district_id: district.id,
      city: "Johannesburg",
      theme_preset: "ocean-blue",
    })
    .select("id")
    .single();
  if (createErr || !created) throw new Error(`Club create failed: ${createErr?.message}`);
  return created.id;
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

test.beforeEach(teardownPlayer);
test.afterEach(teardownPlayer);

test("phase-5: invite → accept → wizard → /play → novice badge → dual-club switcher", async ({
  page,
}) => {
  const demoClubId = await getDemoClubId();
  const testClubId = await ensureTestClub();

  // 1. Sign in as club_admin --------------------------------------------------
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(DEV_PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/manage/, { timeout: 30_000 });

  // 2. Invite the test player via /manage/members -----------------------------
  await page.goto("/manage/members");
  await page.getByTestId("invite-player-trigger").click();
  // The dialog has shadcn Form fields with labels Email / First name / Last name.
  await page.getByLabel("Email", { exact: true }).fill(PLAYER_EMAIL);
  await page.getByLabel(/first name/i).fill("Lerato");
  await page.getByLabel(/last name/i).fill("Ndlovu");
  await page.getByRole("button", { name: /send invite/i }).click();

  // Dev banner appears with the invite URL.
  const banner = page.getByTestId("dev-invite-banner");
  await expect(banner).toBeVisible({ timeout: 10_000 });
  const inviteUrl = (await page.getByTestId("dev-invite-banner-url").textContent())?.trim() ?? "";
  expect(inviteUrl).toMatch(/\/invite\/[A-Za-z0-9._-]+/);

  // 3. Sign out ---------------------------------------------------------------
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL(/\/login/, { timeout: 30_000 });

  // 4. Accept the invite ------------------------------------------------------
  await page.goto(inviteUrl);
  await page.getByLabel(/set a password/i).fill(PLAYER_PASSWORD);
  // The auth Checkbox primitive uses a sr-only input wrapped in a label —
  // clicking the input directly is intercepted by the label, so target the
  // label text via getByText.
  await page.getByText(/i agree to the club/i).click();
  await page.getByRole("button", { name: /accept invite/i }).click();

  // homeFor('player') = /play; (gated) layout sees profile_completed=false
  // and redirects to /me/setup.
  await page.waitForURL(/\/me\/setup/, { timeout: 30_000 });

  // 5. Walk the 4 wizard steps -----------------------------------------------
  // Step 1 — identity. first/last prefilled from the invite row.
  await expect(page.getByTestId("setup-first-name")).toHaveValue("Lerato");
  await expect(page.getByTestId("setup-last-name")).toHaveValue("Ndlovu");
  await page.getByTestId("setup-gender").click();
  await page.getByRole("option", { name: "Female" }).click();
  await page.getByTestId("setup-dob").fill("1990-05-15");
  await page.getByTestId("wizard-next").click();
  await expect(page.getByTestId("setup-wizard")).toHaveAttribute("data-current-step", "2", {
    timeout: 10_000,
  });

  // Step 2 — bowls.
  await page.getByTestId("setup-club-grading").click();
  await page.getByRole("option", { name: "Lead" }).click();
  await page.getByTestId("setup-dominant-hand").click();
  await page.getByRole("option", { name: "Right" }).click();
  await page.getByTestId("wizard-next").click();
  await expect(page.getByTestId("setup-wizard")).toHaveAttribute("data-current-step", "3");

  // Step 3 — contact. Phone optional; opt-in defaults true.
  await expect(page.getByTestId("setup-email-locked")).toHaveValue(PLAYER_EMAIL);
  await page.getByTestId("wizard-next").click();
  await expect(page.getByTestId("setup-wizard")).toHaveAttribute("data-current-step", "4");

  // Step 4 — consent.
  await page.getByTestId("setup-agree-terms").click();
  await page.getByTestId("setup-agree-privacy").click();
  await page.getByTestId("wizard-submit").click();

  // 6. /play loads + novice badge visible ------------------------------------
  // 90s wait absorbs the documented Phase-13 Windows-prod-server slow-cold-
  // serve drift on first POST to a route. The wizard submit hits a fresh
  // /play render after router.replace, often the slowest cold path.
  await page.waitForURL(/\/play/, { timeout: 90_000 });
  await expect(page.getByTestId("novice-badge")).toBeVisible({ timeout: 30_000 });

  // Single membership — switcher hidden.
  await expect(page.getByTestId("club-switcher")).toBeHidden();

  // 7. Service-role attaches player to the second club -----------------------
  const admin = adminClient();
  const { data: usersList } = await admin.auth.admin.listUsers();
  const player = usersList?.users.find((u) => u.email === PLAYER_EMAIL);
  expect(player).toBeDefined();
  const { error: insertErr } = await admin.from("club_memberships").insert({
    profile_id: player!.id,
    club_id: testClubId,
    is_primary: false,
    status: "active",
  });
  expect(insertErr, "second-club membership insert should succeed").toBeNull();

  // 8. Refresh the player's JWT so it picks up the new club_id ---------------
  // The custom_access_token_hook (migration 009) bakes club_ids into the JWT
  // at issuance. When service-role adds a membership, the existing JWT's
  // claim is stale — the player_read_own_clubs RLS policy then blocks the
  // new club's row in the !inner join, dropping the membership from the
  // layout's render. Sign out + back in re-issues with fresh claims.
  // (Production flow: invite accept signs the user in, which refreshes
  // for free. The test bypasses invite accept to avoid the
  // existing-user-already-has-auth-account conflict, hence this manual
  // refresh.)
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL(/\/login/, { timeout: 30_000 });
  await page.getByLabel("Email").fill(PLAYER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PLAYER_PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/play/, { timeout: 30_000 });

  // 9. Switcher now visible (memberships >= 2) -------------------------------
  const switcher = page.getByTestId("club-switcher");
  await expect(switcher).toBeVisible({ timeout: 10_000 });

  // 9. Switch primary to the second club -------------------------------------
  await switcher.click();
  await expect(page.getByTestId(`club-switcher-option-${demoClubId}`)).toBeVisible();
  await expect(page.getByTestId(`club-switcher-option-${testClubId}`)).toBeVisible();
  await page.getByTestId(`club-switcher-option-${testClubId}`).click();

  // The action runs, router.refresh() pulls new data, trigger label updates.
  await expect(switcher).toContainText(TEST_CLUB_NAME, { timeout: 10_000 });
});
