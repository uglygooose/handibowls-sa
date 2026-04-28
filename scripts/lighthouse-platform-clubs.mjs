// Phase-4-design close-out perf check.
//
// Logs in as super-admin via Playwright, captures the Supabase auth cookies,
// then drives a Lighthouse desktop audit of /platform/clubs by passing those
// cookies via --extra-headers. Output goes to scripts/lighthouse-platform-clubs.json
// alongside the printed top-level category scores.

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = process.env.LH_BASE_URL ?? "http://127.0.0.1:3000";
const EMAIL = "super@handibowls.local";
const PASSWORD = "dev-password-12345";

const here = dirname(fileURLToPath(import.meta.url));
const reportPath = resolve(here, "lighthouse-platform-clubs.json");
mkdirSync(dirname(reportPath), { recursive: true });

console.log(`[lh] launching chromium for auth handshake against ${BASE}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: BASE });
const page = await ctx.newPage();
await page.goto("/login");
await page.getByLabel("Email").fill(EMAIL);
await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
await page.getByRole("button", { name: /sign in|log in/i }).click();
await page.waitForURL(/\/platform\/clubs/, { timeout: 30_000 });

const cookies = await ctx.cookies();
await browser.close();

const cookieHeader = cookies
  .map((c) => `${c.name}=${c.value}`)
  .join("; ");

// Use Playwright's bundled chromium so we don't need a system Chrome install
// (lighthouse's default chrome-launcher couldn't find one in this WSL env).
const CHROME_PATH =
  process.env.LH_CHROME_PATH ??
  `${process.env.HOME}/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome`;

console.log(`[lh] captured ${cookies.length} cookies — running Lighthouse on /platform/clubs`);
const result = spawnSync(
  "npx",
  [
    "-y",
    "lighthouse",
    `${BASE}/platform/clubs`,
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
console.log("\nLighthouse desktop scores for /platform/clubs:");
for (const key of Object.keys(cats)) {
  const score = cats[key].score == null ? "n/a" : Math.round(cats[key].score * 100);
  console.log(`  ${cats[key].title.padEnd(20)} ${String(score).padStart(3)}`);
}
const finalUrl = report.finalDisplayedUrl ?? report.finalUrl ?? "(unknown)";
console.log(`\n  Final URL: ${finalUrl}`);
