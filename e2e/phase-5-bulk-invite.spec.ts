import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../types/database.types";

// E2E for the Phase-5c bulk-invite flow. Drives the club admin's UI:
// paste CSV → preview classifies rows → submit batch → all N invites land
// in the DB → /manage/members refreshes via router.refresh() and the
// pending-invite rows are visible in the virtualised table.
//
// Closes the partial-close on Phase-5 DOD item 1 (which says "single + CSV"
// — single is covered by phase-5-onboarding.spec.ts).

const ADMIN_EMAIL = "admin@demo.local";
const DEV_PASSWORD = "dev-password-12345";

// Per-run unique emails so re-runs and concurrent suites can't collide.
const RUN_ID = `${Date.now()}`;
const PLAYERS = [
  `phase5-bulk-${RUN_ID}-1@handibowls.test`,
  `phase5-bulk-${RUN_ID}-2@handibowls.test`,
  `phase5-bulk-${RUN_ID}-3@handibowls.test`,
] as const;

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
  // Delete pending invites by email — covers re-runs after a partial pass.
  for (const email of PLAYERS) {
    await admin.from("invites").delete().eq("email", email);
  }
  // The bulk flow doesn't create auth users (it only writes invite rows),
  // so there are no users to delete.
}

test.beforeEach(teardown);
test.afterEach(teardown);

test("phase-5: bulk invite — paste CSV → preview → submit → table refreshes", async ({
  page,
}) => {
  // 1. Sign in as club_admin --------------------------------------------------
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(DEV_PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/manage/, { timeout: 30_000 });

  // 2. Open /manage/members + open the bulk modal -----------------------------
  await page.goto("/manage/members");
  await page.getByTestId("bulk-invite-trigger").click();

  // 3. Paste a 3-row CSV with first/last on rows 1 + 3, email-only on row 2 --
  const csv = [
    "email,first_name,last_name",
    `${PLAYERS[0]},Alpha,One`,
    `${PLAYERS[1]},,`,
    `${PLAYERS[2]},Charlie,Three`,
  ].join("\n");
  await page.getByTestId("bulk-csv-textarea").fill(csv);

  // 4. Preview should classify all three as "create" (none already known) ----
  const preview = page.getByTestId("bulk-csv-preview");
  await expect(preview).toBeVisible({ timeout: 5_000 });
  await expect(preview).toContainText(/3 new/);
  await expect(preview).toContainText(/0 already-known/);
  await expect(preview).toContainText(/0 invalid/);

  // 5. Submit ----------------------------------------------------------------
  const submit = page.getByTestId("bulk-csv-submit");
  await expect(submit).toContainText(/Send 3 invites/);
  await submit.click();

  // 6. Modal closes; await the post-submit toast and table refresh -----------
  // The InvitePlayerModal/BulkInvitePlayersModal both router.refresh() on
  // success, which re-runs the server data fetch and renders the new
  // pending-invite rows.
  await expect(preview).toBeHidden({ timeout: 30_000 });
  // 60s wait absorbs the documented Phase-13 Windows-prod-server slow
  // cold-serve drift (DRIFT_LOG.md → Phase 13). The page re-render after
  // router.refresh() goes through a fresh RSC round-trip.
  await expect(page.getByText(PLAYERS[0])).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(PLAYERS[1])).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(PLAYERS[2])).toBeVisible({ timeout: 30_000 });

  // 7. DB-side verification — three pending player invites exist ------------
  const admin = adminClient();
  const { data: invites } = await admin
    .from("invites")
    .select("email, role, status, first_name, last_name")
    .in("email", PLAYERS as unknown as string[]);
  expect(invites).toHaveLength(3);
  for (const row of invites ?? []) {
    expect(row.role).toBe("player");
    expect(row.status).toBe("pending");
  }
  const byEmail = Object.fromEntries((invites ?? []).map((r) => [r.email, r]));
  expect(byEmail[PLAYERS[0]]?.first_name).toBe("Alpha");
  expect(byEmail[PLAYERS[0]]?.last_name).toBe("One");
  expect(byEmail[PLAYERS[1]]?.first_name).toBeNull();
  expect(byEmail[PLAYERS[1]]?.last_name).toBeNull();
  expect(byEmail[PLAYERS[2]]?.first_name).toBe("Charlie");
  expect(byEmail[PLAYERS[2]]?.last_name).toBe("Three");
});
