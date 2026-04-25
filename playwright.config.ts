import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// Load .env.test so SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL
// are available both to the teardown hook and the spawned dev server.
loadEnv({ path: ".env.test" });

// HandiBowls Playwright config. Used for Phase 4b theme-flip smoke. The
// webServer block runs a production build (next build + next start) because
// Turbopack dev renders can take 30–70s per route on Windows, which blows
// past any reasonable test timeout. Prod-mode renders are sub-second.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // 1 retry locally + on CI: absorbs the documented Windows + Next + RSC
  // cold-stream flake on /platform/clubs/[id] (DRIFT_LOG.md → Phase 13).
  retries: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 300_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
