// Phase 8f-3 — Lighthouse PWA + perf audit across the five player
// surfaces.
//
// Pattern lifted from `scripts/lighthouse-tournament-detail.mjs`:
// Playwright login → capture Supabase auth cookies → drive Lighthouse
// CLI with --extra-headers carrying the cookie. Scope here is wider —
// five mobile-form-factor audits per run instead of one desktop audit.
//
// Runs against `http://127.0.0.1:3000` by default. The server is the
// caller's responsibility — start `next start` (or `next dev` for a
// rough sanity check) before invoking. Lighthouse against `next dev`
// is unreliable for Performance numbers because the dev bundle is
// unminified + carries source maps; the canonical Phase 8 ≥95 PWA
// + ≥90 Perf bar (HANDIBOWLS_REBUILD_PLAN.md:715, 989) is measured
// against `next start` (production build).
//
// Surfaces audited:
//   /play                            — player home (canonical PWA gate)
//   /book                            — booking surface
//   /tournaments                     — entered/available list
//   /me                              — profile + my-bookings
//   /tournaments/[id]/matches/[id]   — scorecard (resolved at runtime)
//
// Each surface gets its own JSON report at scripts/lighthouse-pwa/<slug>.json.
// PWA + Performance scores are summarised at the end. The Phase 8
// success bar is asserted on /play only — other surfaces print
// scores for triage but don't fail the script.

import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = process.env.LH_BASE_URL ?? "http://127.0.0.1:3000";
const EMAIL = process.env.LH_EMAIL ?? "player@demo.local";
const PASSWORD = process.env.LH_PASSWORD ?? "dev-password-12345";

const here = dirname(fileURLToPath(import.meta.url));
const reportDir = resolve(here, "lighthouse-pwa");
mkdirSync(reportDir, { recursive: true });

// Phase 8 success bar (HANDIBOWLS_REBUILD_PLAN.md:715, 989) was written
// against Lighthouse ≤11 which exposed a PWA category. Lighthouse 12+
// REMOVED the PWA category entirely (Chrome's installability story
// moved to runtime checks the static audit couldn't model). Lighthouse
// 13.1.0 (current default via npx) reports `categories.pwa` as
// undefined; the legacy individual audits (installable-manifest,
// service-worker, themed-omnibox, splash-screen, maskable-icon) are
// also gone from the default run.
//
// Structural prerequisites (manifest, SW registration, icons,
// apple-touch-icon) are validated by build + by reading the assets
// directly. Runtime installability — does the browser actually fire
// `beforeinstallprompt`? — is the truth test, performed during human-
// driven mobile QA on real Android Chrome (PHASE_LOG.md operational
// convention).
//
// This script asserts Performance only. PWA-deprecation drift entry
// in DRIFT_LOG.md tracks the spec realignment task for Phase 12.5 / 8g.
const PERF_GATE = 90;
const GATE_PATH = "/play";

console.log(`[lh-pwa] launching chromium for auth handshake against ${BASE}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: BASE });
const page = await ctx.newPage();

await page.goto("/login");
await page.getByLabel("Email").fill(EMAIL);
await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
await page.getByRole("button", { name: /sign in|log in/i }).click();
await page.waitForURL(/\/(play|me|tournaments)/, { timeout: 30_000 });

console.log("[lh-pwa] logged in — resolving scorecard route");
await page.goto("/play");
await page.waitForLoadState("networkidle");

// Resolve the scorecard route from HeroNextMatch's "Score this match"
// link. Falls back to scanning the tournaments list for the first
// match if /play has no hero (player has no upcoming matches). Uses
// .count() to probe the locator without awaiting a 30s default
// timeout when zero matches exist.
async function resolveScorecardPath() {
  const onPlay = await page.locator("a[href*='/matches/']").count();
  if (onPlay > 0) {
    return page.locator("a[href*='/matches/']").first().getAttribute("href");
  }
  await page.goto("/tournaments");
  await page.waitForLoadState("networkidle");
  const onTournaments = await page.locator("a[href*='/matches/']").count();
  if (onTournaments > 0) {
    return page.locator("a[href*='/matches/']").first().getAttribute("href");
  }
  return null;
}
const scorecardPath = await resolveScorecardPath();
if (!scorecardPath) {
  console.warn(
    "[lh-pwa] no scorecard route reachable from this session — skipping",
  );
}

const cookies = await ctx.cookies();
await browser.close();
const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
console.log(`[lh-pwa] captured ${cookies.length} cookies`);

// Use Playwright's bundled chromium (lighthouse's chrome-launcher can't
// always find a system Chrome in WSL).
const CHROME_PATH =
  process.env.LH_CHROME_PATH ??
  `${process.env.HOME}/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome`;

const SURFACES = [
  { slug: "play", path: "/play" },
  { slug: "book", path: "/book" },
  { slug: "tournaments", path: "/tournaments" },
  { slug: "me", path: "/me" },
  ...(scorecardPath
    ? [{ slug: "scorecard", path: scorecardPath }]
    : []),
];

const summary = [];
for (const s of SURFACES) {
  const reportPath = resolve(reportDir, `${s.slug}.json`);
  const url = `${BASE}${s.path}`;
  console.log(`\n[lh-pwa] ${s.slug.padEnd(12)} → ${url}`);

  const result = spawnSync(
    "npx",
    [
      "-y",
      "lighthouse",
      url,
      "--form-factor=mobile",
      "--throttling-method=simulate",
      "--quiet",
      "--output=json",
      `--output-path=${reportPath}`,
      `--extra-headers={"Cookie":${JSON.stringify(cookieHeader)}}`,
      "--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage --disable-gpu",
    ],
    {
      stdio: ["ignore", "ignore", "inherit"],
      encoding: "utf-8",
      env: { ...process.env, CHROME_PATH },
    },
  );

  if (result.status !== 0) {
    console.error(`[lh-pwa] ${s.slug}: lighthouse exited ${result.status}`);
    summary.push({ slug: s.slug, error: `exit ${result.status}` });
    continue;
  }

  const report = JSON.parse(await readFile(reportPath, "utf-8"));
  const cats = report.categories;
  const row = {
    slug: s.slug,
    path: s.path,
    performance: pct(cats.performance?.score),
    accessibility: pct(cats.accessibility?.score),
    bestPractices: pct(cats["best-practices"]?.score),
    seo: pct(cats.seo?.score),
    pwa: pct(cats.pwa?.score),
  };
  summary.push(row);
  console.log(
    `  Perf ${fmt(row.performance)}  A11y ${fmt(row.accessibility)}  BP ${fmt(row.bestPractices)}  SEO ${fmt(row.seo)}  PWA ${fmt(row.pwa)}`,
  );
}

function pct(score) {
  return score == null ? null : Math.round(score * 100);
}
function fmt(n) {
  return String(n ?? "n/a").padStart(3);
}

console.log("\n=== Lighthouse PWA summary ===");
console.log(
  "Surface".padEnd(14) +
    "Path".padEnd(40) +
    "Perf".padStart(6) +
    "A11y".padStart(6) +
    "BP".padStart(6) +
    "SEO".padStart(6) +
    "PWA".padStart(6),
);
for (const r of summary) {
  if (r.error) {
    console.log(`${r.slug.padEnd(14)} ${"ERROR".padEnd(40)} ${r.error}`);
    continue;
  }
  console.log(
    r.slug.padEnd(14) +
      r.path.padEnd(40) +
      fmt(r.performance).padStart(6) +
      fmt(r.accessibility).padStart(6) +
      fmt(r.bestPractices).padStart(6) +
      fmt(r.seo).padStart(6) +
      fmt(r.pwa).padStart(6),
  );
}

// Lighthouse 13+ no longer reports a PWA category — flag it loud so
// the operator doesn't silently miss the deprecation. The "n/a" rows
// in the summary table above already imply this; the explicit note
// here surfaces it next to the gate result.
console.log(
  "\n[note] Lighthouse 13+ deprecated the PWA category — `n/a` is expected.",
);
console.log(
  "       Manifest + SW + icons validated structurally; install prompt verified",
);
console.log(
  "       on real Android Chrome during human-driven mobile QA.",
);

// Phase 8 success bar — assert Performance ≥90 on /play.
const gateRow = summary.find((r) => r.path === GATE_PATH);
if (!gateRow || gateRow.error) {
  console.error(`\n[lh-pwa] gate failed: ${GATE_PATH} did not produce a report`);
  process.exit(1);
}
if (gateRow.performance == null || gateRow.performance < PERF_GATE) {
  console.error(
    `\n[lh-pwa] ${GATE_PATH} below Phase 8 perf bar: Performance ${gateRow.performance} < ${PERF_GATE}`,
  );
  process.exit(2);
}

console.log(
  `\n[lh-pwa] OK — ${GATE_PATH}: Performance ${gateRow.performance}`,
);
