// Phase 13 / 13-1 — A11y baseline + close-gate measurement.
//
// Captures Lighthouse Accessibility + Performance scores AND axe-core
// violation counts for the 10 anchor surfaces from the 13-1 kickoff.
//
// Targets Vercel preview deployments (SSO-protected). Cookie layering:
//   1. Vercel deployment-protection bypass — token in env
//      `VERCEL_PROTECTION_BYPASS`, applied via the documented query-param
//      pattern `?x-vercel-protection-bypass=<token>&x-vercel-set-bypass-cookie=true`
//      which sets a `_vercel_jwt` cookie on the preview domain.
//   2. Supabase auth cookies — captured via Playwright login per role
//      (player / club_admin / super_admin). The Phase 11 `lib/supabase/server.ts`
//      writes `sb-<ref>-auth-token` cookies that the Vercel-deployed app reads.
//
// Both cookie layers are passed to Lighthouse CLI via `--extra-headers`;
// axe-core is injected directly into the Playwright page context.
//
// Usage:
//   PREVIEW_URL=https://handibowls-xxx.vercel.app npm run baseline:13-1
//   PREVIEW_URL=... node scripts/baseline-13-1.mjs --skip-lighthouse  # axe only
//   PREVIEW_URL=... node scripts/baseline-13-1.mjs --surfaces=play,me # subset
//
// Output:
//   docs/audit/phase-13/baseline-13-1.json — full per-surface results
//   docs/audit/phase-13/baseline-13-1.md   — human-readable summary table

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// --- env loading ---------------------------------------------------------
function loadEnv() {
  for (const p of [".env.local", ".env"]) {
    const full = resolve(REPO_ROOT, p);
    try {
      const txt = readFileSync(full, "utf8");
      for (const line of txt.split("\n")) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      /* not present, fine */
    }
  }
}
loadEnv();

const PREVIEW_URL = process.env.PREVIEW_URL ?? process.argv.find((a) => a.startsWith("--url="))?.slice(6);
const BYPASS = process.env.VERCEL_PROTECTION_BYPASS;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!PREVIEW_URL) throw new Error("PREVIEW_URL env or --url= required");
if (!BYPASS) throw new Error("VERCEL_PROTECTION_BYPASS env required");
if (!SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL env required");

const SKIP_LIGHTHOUSE = process.argv.includes("--skip-lighthouse");
const SURFACE_FILTER = process.argv
  .find((a) => a.startsWith("--surfaces="))
  ?.slice(11)
  ?.split(",");

const PASSWORD = "dev-password-12345";

// --- the 10 anchor surfaces ----------------------------------------------
// Each entry: { id, route, role, label }
// `role: null` = public surface (no Supabase login, just Vercel bypass).
const SURFACES = [
  { id: "landing",         route: "/",                      role: null,          label: "/ (landing)" },
  { id: "login",           route: "/login",                 role: null,          label: "/login (auth)" },
  { id: "play",            route: "/play",                  role: "player",      label: "/play (player home)" },
  { id: "tournament-detail", route: null /* resolved at runtime */, role: "player", label: "/tournaments/[id] (player detail)" },
  { id: "t20",             route: "/t20",                   role: "player",      label: "/t20 (player T20 hub)" },
  { id: "me",              route: "/me",                    role: "player",      label: "/me (player profile)" },
  { id: "manage",          route: "/manage/overview",       role: "club_admin",  label: "/manage (club admin overview)" },
  { id: "admin-tournament-detail", route: null /* resolved */, role: "club_admin", label: "/manage/tournaments/[id] (L67=85 surface)" },
  { id: "manage-members",  route: "/manage/members",        role: "club_admin",  label: "/manage/members (Tier E anchor)" },
  { id: "platform-clubs",  route: "/platform/clubs",        role: "super_admin", label: "/platform/clubs (super admin)" },
];

const ROLE_EMAILS = {
  player: "player@demo.local",
  club_admin: "admin@demo.local",
  super_admin: "super@handibowls.local",
};

// --- helpers -------------------------------------------------------------
function bypassUrl(path) {
  // First-time access: append the bypass query so Vercel sets the cookie.
  // Subsequent navigations (post-set-cookie) need only the cookie.
  const url = new URL(path, PREVIEW_URL);
  url.searchParams.set("x-vercel-protection-bypass", BYPASS);
  url.searchParams.set("x-vercel-set-bypass-cookie", "true");
  return url.toString();
}

async function loginAs(page, role) {
  const email = ROLE_EMAILS[role];
  const loginUrl = bypassUrl("/login");
  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
  // Wait for the form (auth surfaces are fast) and fill it.
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await Promise.all([
    page.waitForLoadState("networkidle", { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function resolveDynamicRoute(context, role, kind) {
  // /tournaments/[id] (player) and /manage/tournaments/[id] (admin)
  // — resolve to a real ID by reading the corresponding list page first.
  const page = await context.newPage();
  if (kind === "player") {
    await page.goto(bypassUrl("/tournaments"), { waitUntil: "domcontentloaded" });
  } else {
    await page.goto(bypassUrl("/manage/tournaments"), { waitUntil: "domcontentloaded" });
  }
  // First link with a UUID-ish path segment.
  const href = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll("a")).find((el) => {
      const h = el.getAttribute("href") ?? "";
      return /\/tournaments\/[0-9a-f]{8}-[0-9a-f]{4}/.test(h);
    });
    return a?.getAttribute("href") ?? null;
  });
  await page.close();
  return href; // returns the relative href or null
}

async function injectAxe(page) {
  const axeSrc = readFileSync(resolve(REPO_ROOT, "node_modules/axe-core/axe.min.js"), "utf8");
  await page.addScriptTag({ content: axeSrc });
}

async function runAxe(page) {
  return await page.evaluate(async () => {
    // @ts-expect-error axe is injected
    const results = await axe.run(document, { resultTypes: ["violations"] });
    return {
      violations: results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        help: v.help,
        nodeCount: v.nodes.length,
        nodes: v.nodes.slice(0, 12).map((n) => ({
          target: n.target,
          html: n.html?.slice(0, 240),
          failureSummary: n.failureSummary,
        })),
      })),
      counts: {
        critical: results.violations.filter((v) => v.impact === "critical").length,
        serious:  results.violations.filter((v) => v.impact === "serious").length,
        moderate: results.violations.filter((v) => v.impact === "moderate").length,
        minor:    results.violations.filter((v) => v.impact === "minor").length,
        total:    results.violations.length,
      },
    };
  });
}

function runLighthouse(targetUrl, cookies, formFactor = "desktop") {
  // Build the cookie header. Lighthouse CLI ignores set-cookies returned during
  // the run, so we pre-populate via --extra-headers.
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const headers = JSON.stringify({ Cookie: cookieHeader });

  // WSL doesn't ship a Chrome binary by default; Lighthouse's chrome-launcher
  // can't find one and reports "Unable to connect to Chrome." Point it at the
  // full chromium binary that Playwright already installs (NOT the
  // chrome-headless-shell — Lighthouse needs the full browser for some audits).
  const env = {
    ...process.env,
    CHROME_PATH: process.env.CHROME_PATH ?? "/home/uglygoose/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome",
  };

  const out = spawnSync(
    "npx",
    [
      "--yes",
      "lighthouse",
      targetUrl,
      "--output=json",
      "--quiet",
      "--chrome-flags=--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage",
      `--form-factor=${formFactor}`,
      "--screen-emulation.disabled",
      `--extra-headers=${headers}`,
      "--only-categories=accessibility,performance,best-practices,seo",
      "--max-wait-for-load=45000",
    ],
    { encoding: "utf8", maxBuffer: 50 * 1024 * 1024, env },
  );

  if (out.status !== 0) {
    return { error: out.stderr?.slice(-500) ?? "lighthouse non-zero exit", scores: null };
  }
  try {
    const json = JSON.parse(out.stdout);
    return {
      scores: {
        accessibility: Math.round((json.categories?.accessibility?.score ?? 0) * 100),
        performance:   Math.round((json.categories?.performance?.score   ?? 0) * 100),
        bestPractices: Math.round((json.categories?.["best-practices"]?.score ?? 0) * 100),
        seo:           Math.round((json.categories?.seo?.score           ?? 0) * 100),
      },
    };
  } catch (e) {
    return { error: `parse: ${e.message}`, scores: null };
  }
}

// --- main loop -----------------------------------------------------------
async function main() {
  console.log(`[baseline-13-1] preview: ${PREVIEW_URL}`);
  console.log(`[baseline-13-1] supabase: ${SUPABASE_URL}`);
  console.log(`[baseline-13-1] surfaces: ${SURFACES.length} (axe + ${SKIP_LIGHTHOUSE ? "no lighthouse" : "lighthouse"})`);

  const browser = await chromium.launch({ headless: true });
  const contexts = {
    public: await browser.newContext(),
    player: await browser.newContext(),
    club_admin: await browser.newContext(),
    super_admin: await browser.newContext(),
  };

  // Prime each context with the Vercel bypass cookie + Supabase login.
  for (const role of ["player", "club_admin", "super_admin"]) {
    const page = await contexts[role].newPage();
    console.log(`[baseline-13-1] login: ${role} (${ROLE_EMAILS[role]})`);
    await loginAs(page, role);
    await page.close();
  }
  // Public context just needs the Vercel bypass cookie.
  {
    const page = await contexts.public.newPage();
    await page.goto(bypassUrl("/"), { waitUntil: "domcontentloaded" });
    await page.close();
  }

  // Resolve dynamic IDs for the two tournament-detail surfaces.
  const playerTournamentHref  = await resolveDynamicRoute(contexts.player,     "player");
  const adminTournamentHref   = await resolveDynamicRoute(contexts.club_admin, "admin");
  console.log(`[baseline-13-1] resolved: player=${playerTournamentHref}, admin=${adminTournamentHref}`);

  const surfaces = SURFACES.map((s) => {
    if (s.id === "tournament-detail")        return { ...s, route: playerTournamentHref };
    if (s.id === "admin-tournament-detail")  return { ...s, route: adminTournamentHref };
    return s;
  }).filter((s) => !SURFACE_FILTER || SURFACE_FILTER.includes(s.id));

  const results = [];
  for (const s of surfaces) {
    if (!s.route) {
      results.push({ ...s, axe: null, lighthouse: null, error: "could not resolve route" });
      console.log(`  [SKIP] ${s.label} — could not resolve route`);
      continue;
    }
    const ctx = contexts[s.role ?? "public"];
    const targetUrl = bypassUrl(s.route);
    console.log(`  [run]  ${s.label} → ${s.route}`);

    // axe via Playwright
    const page = await ctx.newPage();
    let axe = null;
    try {
      await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60_000 });
      await injectAxe(page);
      axe = await runAxe(page);
    } catch (e) {
      axe = { error: e.message };
    } finally {
      await page.close();
    }

    // Lighthouse CLI with cookie injection
    let lighthouse = null;
    if (!SKIP_LIGHTHOUSE) {
      const cookies = await ctx.cookies();
      lighthouse = runLighthouse(targetUrl, cookies, s.id === "manage" || s.id === "platform-clubs" || s.id === "admin-tournament-detail" || s.id === "manage-members" ? "desktop" : "mobile");
    }

    const aSummary = axe?.counts ? `axe: c=${axe.counts.critical} s=${axe.counts.serious} m=${axe.counts.moderate} n=${axe.counts.minor}` : `axe: ${axe?.error ?? "?"}`;
    const lhSummary = lighthouse?.scores
      ? `lh: a11y=${lighthouse.scores.accessibility} perf=${lighthouse.scores.performance} bp=${lighthouse.scores.bestPractices} seo=${lighthouse.scores.seo}`
      : (lighthouse?.error ? `lh: ${lighthouse.error.slice(0, 80)}` : "lh: skipped");
    console.log(`         ${aSummary} | ${lhSummary}`);

    results.push({ ...s, axe, lighthouse });
  }

  await browser.close();

  // Persist
  const outDir = resolve(REPO_ROOT, "docs/audit/phase-13");
  mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString();
  const json = { capturedAt: ts, previewUrl: PREVIEW_URL, results };
  writeFileSync(resolve(outDir, "baseline-13-1.json"), JSON.stringify(json, null, 2));

  // Human summary
  const md = renderSummary(results, ts);
  writeFileSync(resolve(outDir, "baseline-13-1.md"), md);
  console.log(`\n[baseline-13-1] wrote docs/audit/phase-13/baseline-13-1.{json,md}`);
}

function renderSummary(results, ts) {
  const lines = [];
  lines.push(`# Phase 13 / 13-1 — A11y Baseline\n`);
  lines.push(`Captured: ${ts}`);
  lines.push(`Preview: ${PREVIEW_URL}\n`);
  lines.push(`## Per-surface scores\n`);
  lines.push(`| Surface | Lighthouse a11y | Lighthouse perf | axe critical | axe serious | axe moderate | axe minor |`);
  lines.push(`|---|---:|---:|---:|---:|---:|---:|`);
  for (const r of results) {
    const lh = r.lighthouse?.scores;
    const a = r.axe?.counts;
    lines.push(`| ${r.label} | ${lh?.accessibility ?? "—"} | ${lh?.performance ?? "—"} | ${a?.critical ?? "—"} | ${a?.serious ?? "—"} | ${a?.moderate ?? "—"} | ${a?.minor ?? "—"} |`);
  }
  lines.push(``);
  lines.push(`## axe violation breakdown (per surface)\n`);
  for (const r of results) {
    if (!r.axe?.violations || r.axe.violations.length === 0) continue;
    lines.push(`### ${r.label}`);
    lines.push(`| Rule | Impact | Nodes | Description |`);
    lines.push(`|---|---|---:|---|`);
    for (const v of r.axe.violations) {
      lines.push(`| \`${v.id}\` | ${v.impact} | ${v.nodeCount} | ${v.help} |`);
    }
    lines.push(``);
  }
  lines.push(`## Stage 2 close-gate targets\n`);
  lines.push(`- Lighthouse Accessibility ≥ 95 on all 10 surfaces.`);
  lines.push(`- axe critical violations = 0 on all 10 surfaces.`);
  return lines.join("\n");
}

main().catch((e) => {
  console.error("[baseline-13-1] FATAL:", e);
  process.exit(1);
});
