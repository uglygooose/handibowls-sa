// Phase-7e close-out perf check.
//
// Logs in as club_admin via Playwright, captures the Supabase auth cookies,
// then drives a Lighthouse desktop audit of /manage/tournaments/[id] by
// passing those cookies via --extra-headers. Output goes to
// scripts/lighthouse-tournament-detail.json alongside the printed top-level
// category scores.
//
// Tournament ID is resolved by visiting /manage/tournaments and reading the
// first row's "Manage" link (data-testid="tournament-row-<id>"). If the club
// has no tournaments, the script exits with a clear error before lighthouse
// runs.
//
// Pattern lifted from Phase-4's scripts/lighthouse-platform-clubs.mjs (which
// audited /platform/clubs for the redesigned ClubsTable).

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = process.env.LH_BASE_URL ?? "http://127.0.0.1:3000";
const EMAIL = process.env.LH_EMAIL ?? "admin@demo.local";
const PASSWORD = process.env.LH_PASSWORD ?? "dev-password-12345";

const here = dirname(fileURLToPath(import.meta.url));
const reportPath = resolve(here, "lighthouse-tournament-detail.json");
mkdirSync(dirname(reportPath), { recursive: true });

console.log(`[lh] launching chromium for auth handshake against ${BASE}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: BASE });
const page = await ctx.newPage();

await page.goto("/login");
await page.getByLabel("Email").fill(EMAIL);
await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
await page.getByRole("button", { name: /sign in|log in/i }).click();
await page.waitForURL(/\/(manage|platform|play)/, { timeout: 30_000 });

console.log(`[lh] logged in — finding a tournament to audit`);
await page.goto("/manage/tournaments");
await page.waitForLoadState("networkidle");

// Match either the list-view rows (data-testid) or the grid-view links.
const firstHref = await page
  .locator("a[href^='/manage/tournaments/']:not([href$='/new'])")
  .first()
  .getAttribute("href");

if (!firstHref) {
  await browser.close();
  console.error(
    `[lh] no tournaments visible to ${EMAIL} — seed one before running this audit`,
  );
  process.exit(2);
}

const auditUrl = `${BASE}${firstHref}`;
console.log(`[lh] target → ${auditUrl}`);

const cookies = await ctx.cookies();
await browser.close();

const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

// Use Playwright's bundled chromium so we don't need a system Chrome install
// (lighthouse's default chrome-launcher couldn't find one in this WSL env).
const CHROME_PATH =
  process.env.LH_CHROME_PATH ??
  `${process.env.HOME}/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome`;

console.log(`[lh] captured ${cookies.length} cookies — running Lighthouse`);
const result = spawnSync(
  "npx",
  [
    "-y",
    "lighthouse",
    auditUrl,
    "--preset=desktop",
    "--quiet",
    "--output=json",
    `--output-path=${reportPath}`,
    `--extra-headers={"Cookie":${JSON.stringify(cookieHeader)}}`,
    "--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage --disable-gpu",
  ],
  {
    stdio: "inherit",
    encoding: "utf-8",
    env: { ...process.env, CHROME_PATH },
  },
);

if (result.status !== 0) {
  console.error(`[lh] lighthouse exited ${result.status}`);
  process.exit(result.status ?? 1);
}

const report = JSON.parse(
  await (await import("node:fs/promises")).readFile(reportPath, "utf-8"),
);
const cats = report.categories;
console.log("\nLighthouse desktop scores for /manage/tournaments/[id]:");
const summary = {};
for (const key of Object.keys(cats)) {
  const score = cats[key].score == null ? null : Math.round(cats[key].score * 100);
  summary[cats[key].title] = score;
  console.log(`  ${cats[key].title.padEnd(20)} ${String(score ?? "n/a").padStart(3)}`);
}
const finalUrl = report.finalDisplayedUrl ?? report.finalUrl ?? "(unknown)";
console.log(`\n  Final URL: ${finalUrl}`);

const perf = summary["Performance"];
if (perf != null && perf < 85) {
  console.warn(
    `\n[lh] performance ${perf} below 85 target — Phase 7e fail-loud threshold`,
  );
  process.exit(3);
}
