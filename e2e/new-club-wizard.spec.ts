import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../types/database.types";

// End-to-end new-club wizard. Super-admin walks all 5 steps, creates
// a brand-new club, lands on the detail page, and asserts:
//   • club appears in the list
//   • theme preset + name match
//   • dev invite banner renders with the admin invite URL
//
// Teardown deletes the created club (cascades through greens, rinks,
// invites, assignments, audit). Idempotent — safe to re-run.

const SUPER_EMAIL = "super@handibowls.local";
const DEV_PASSWORD = "dev-password-12345";

const TEST_CLUB_NAME = "Gauteng North Test Club";
const TEST_CLUB_SHORT = "GNTC";
const TEST_CLUB_SLUG = "gauteng-north-test";
const TEST_CLUB_CITY = "Pretoria";
const TEST_ADMIN_EMAIL = "gntc-admin@handibowls.test";
const TEST_PLAYER_EMAIL = "gntc-player@handibowls.test";
const TEST_THEME = "ocean-blue";

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
  // Club delete cascades to greens, rinks, invites, assignments, audit.
  await admin.from("clubs").delete().eq("slug", TEST_CLUB_SLUG);
  // Best-effort delete of the auth users that were only created by this
  // test so re-runs don't trip the unique-email constraint in auth.users.
  const emails = [TEST_ADMIN_EMAIL, TEST_PLAYER_EMAIL];
  const { data } = await admin.auth.admin.listUsers();
  for (const user of data?.users ?? []) {
    if (user.email && emails.includes(user.email)) {
      await admin.auth.admin.deleteUser(user.id);
    }
  }
}

test.beforeEach(async () => {
  await teardown();
});
test.afterEach(async () => {
  await teardown();
});

test("super-admin creates a club through the 5-step wizard", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(SUPER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(DEV_PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/platform\/clubs/, { timeout: 30_000 });

  // Navigate to the wizard.
  await page.goto("/platform/clubs/new");
  await expect(page.getByTestId("new-club-wizard")).toHaveAttribute(
    "data-current-step",
    "1",
  );

  // ---- Step 1 — club details -------------------------------------------
  await page.getByTestId("field-name").fill(TEST_CLUB_NAME);
  await page.getByTestId("field-short-name").fill(TEST_CLUB_SHORT);
  // Slug is auto-derived from the name; override it to the canonical
  // form the test expects (also exercises the slugTouched path).
  await page.getByTestId("field-slug").fill(TEST_CLUB_SLUG);

  // Open the district Select and pick the first option. Radix exposes
  // a native <select> sibling for a11y in jsdom; in Playwright we drive
  // the radix trigger.
  await page.getByTestId("field-district").click();
  const firstDistrict = page.locator("[data-testid^='district-']").first();
  await firstDistrict.waitFor({ state: "visible", timeout: 10_000 });
  await firstDistrict.click();

  await page.getByTestId("field-city").fill(TEST_CLUB_CITY);
  await page.getByTestId(`theme-preset-${TEST_THEME}`).click();
  await expect(page.getByTestId("theme-preview-live")).toBeVisible();

  await page.getByTestId("wizard-next").click();
  await expect(page.getByTestId("new-club-wizard")).toHaveAttribute(
    "data-current-step",
    "2",
    { timeout: 10_000 },
  );

  // ---- Step 2 — admin invite -------------------------------------------
  await page.getByTestId("field-admin-email").fill(TEST_ADMIN_EMAIL);
  await page.getByTestId("wizard-next").click();
  await expect(page.getByTestId("new-club-wizard")).toHaveAttribute(
    "data-current-step",
    "3",
  );

  // ---- Step 3 — greens + rinks -----------------------------------------
  await page.getByTestId("green-0-name").fill("Main Green");
  await page.getByTestId("green-0-rinks").fill("6");
  await page.getByTestId("greens-add").click();
  await page.getByTestId("green-1-name").fill("East Green");
  await page.getByTestId("green-1-rinks").fill("6");
  await page.getByTestId("wizard-next").click();
  await expect(page.getByTestId("new-club-wizard")).toHaveAttribute(
    "data-current-step",
    "4",
  );

  // ---- Step 4 — initial players ----------------------------------------
  await page.getByTestId("draft-first-name").fill("Test");
  await page.getByTestId("draft-last-name").fill("Player");
  await page.getByTestId("draft-email").fill(TEST_PLAYER_EMAIL);
  await page.getByTestId("draft-add").click();
  await expect(page.getByTestId("player-row-0")).toBeVisible();
  await page.getByTestId("wizard-next").click();
  await expect(page.getByTestId("new-club-wizard")).toHaveAttribute(
    "data-current-step",
    "5",
  );

  // ---- Step 5 — review + publish ---------------------------------------
  await expect(page.getByTestId("review-card-1")).toContainText(TEST_CLUB_NAME);
  await expect(page.getByTestId("review-card-2")).toContainText(TEST_ADMIN_EMAIL);
  await expect(page.getByTestId("review-card-3")).toContainText("Main Green");
  await expect(page.getByTestId("review-card-4")).toContainText(
    TEST_PLAYER_EMAIL,
  );

  await page.getByTestId("wizard-submit").click();
  // Land on the detail page.
  await page.waitForURL(/\/platform\/clubs\/[0-9a-f-]{36}$/, {
    timeout: 30_000,
  });

  // Dev invite banner is rendered with the admin invite URL.
  const banner = page.getByTestId("dev-invite-banner");
  await expect(banner).toBeVisible({ timeout: 10_000 });
  const url = await page.getByTestId("dev-invite-banner-url").textContent();
  expect(url).toMatch(/\/invite\/[A-Za-z0-9._-]+/);

  // Navigate back to the list; the new club is present.
  await page.goto("/platform/clubs");
  const row = page
    .locator("a[data-testid^='club-row-']")
    .filter({ hasText: TEST_CLUB_NAME });
  await expect(row).toBeVisible({ timeout: 30_000 });
});
