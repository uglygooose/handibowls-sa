import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../types/database.types";

// End-to-end theme flip. Super-admin logs in → /platform/clubs → Demo row
// → Theme tab → ocean-green (current, Henselite default) → ocean-blue →
// confirm. Then logs out, logs in as player@demo.local, and verifies
// /play renders with the ocean-blue preset applied.
//
// Teardown: always reverts Demo back to ocean-green via a service-role
// SQL update so rerunning the test starts from a clean state.

const SUPER_EMAIL = "super@handibowls.local";
const PLAYER_EMAIL = "player@demo.local";
const DEV_PASSWORD = "dev-password-12345";
const DEMO_SLUG = "demo-bowls-club";
const ORIGINAL_PRESET = "ocean-green";
const TARGET_PRESET = "ocean-blue";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
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

async function resetTheme() {
  const admin = adminClient();
  const { error } = await admin
    .from("clubs")
    .update({ theme_preset: ORIGINAL_PRESET })
    .eq("slug", DEMO_SLUG);
  if (error) throw new Error(`resetTheme: ${error.message}`);
}

test.afterEach(async () => {
  await resetTheme();
});

test("super-admin flips the Demo club theme and the player sees it on /play", async ({
  browser,
}) => {
  // ---- Super-admin session ------------------------------------------------
  const superCtx = await browser.newContext();
  const superPage = await superCtx.newPage();

  await superPage.goto("/login");
  await superPage.getByLabel("Email").fill(SUPER_EMAIL);
  await superPage.getByLabel("Password", { exact: true }).fill(DEV_PASSWORD);
  await superPage.getByRole("button", { name: /sign in|log in/i }).click();

  await superPage.waitForURL(/\/platform\/clubs/, { timeout: 30_000 });

  // Wait for the ClubsTable client component to hydrate and render at least
  // one row. networkidle is unreliable in Next.js prod due to nav-link
  // prefetches that race with the initial paint.
  const demoRowLink = superPage
    .locator("a[data-testid^='club-row-']")
    .filter({ hasText: "Demo" });
  await expect(demoRowLink).toBeVisible({ timeout: 60_000 });

  // Open the Demo row
  await demoRowLink.click();
  await superPage.waitForURL(/\/platform\/clubs\/[0-9a-f-]+/, { timeout: 60_000 });

  // Jump to Theme tab — wait for the tab strip to hydrate before clicking.
  const themeTab = superPage.getByTestId("tab-theme");
  await expect(themeTab).toBeVisible({ timeout: 60_000 });
  await themeTab.click();
  await superPage.waitForURL(/tab=theme/, { timeout: 60_000 });

  // Confirm ocean-green is the current preset before the flip
  const currentChip = superPage.locator("[data-testid='theme-preset-ocean-green']");
  await expect(currentChip).toHaveAttribute("data-current", "true");

  // Pick ocean-blue → confirm
  await superPage.getByTestId("theme-preset-ocean-blue").click();
  await expect(superPage.getByTestId("theme-confirm-dialog")).toBeVisible();
  await superPage.getByTestId("theme-confirm").click();

  // Dialog closes, preview swatch shows ocean-blue, and after router.refresh
  // the current badge moves to ocean-blue.
  await expect(superPage.getByTestId("theme-confirm-dialog")).toBeHidden();
  await expect(superPage.locator("[data-testid='theme-preview-swatch']")).toHaveAttribute(
    "data-preset",
    "ocean-blue",
  );
  await expect(
    superPage.locator("[data-testid='theme-preset-ocean-blue']"),
  ).toHaveAttribute("data-current", "true");

  // Log out from the super-admin session (clear cookies is simpler than
  // navigating the nav — logout UI may not be part of Phase 4b yet).
  await superCtx.clearCookies();
  await superPage.close();
  await superCtx.close();

  // ---- Player session -----------------------------------------------------
  const playerCtx = await browser.newContext();
  const playerPage = await playerCtx.newPage();

  await playerPage.goto("/login");
  await playerPage.getByLabel("Email").fill(PLAYER_EMAIL);
  await playerPage.getByLabel("Password", { exact: true }).fill(DEV_PASSWORD);
  await playerPage.getByRole("button", { name: /sign in|log in/i }).click();

  await playerPage.waitForURL(/\/play/, { timeout: 15_000 });

  // The ThemeApplier writes data-theme on <html>. We assert that it matches
  // the new preset.
  const root = playerPage.locator("html");
  await expect(root).toHaveAttribute("data-theme", TARGET_PRESET);

  await playerPage.close();
  await playerCtx.close();
});
