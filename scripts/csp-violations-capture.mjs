// Phase 13 / 13-2 / Batch D-CSP — CSP violations capture.
//
// Walks the M3 baseline list of anchor surfaces against either a
// local dev server or a Vercel preview, captures every
// securitypolicyviolation + console CSP message, and reports
// per-surface counts + a deduped sample of violation directives.
//
// Usage:
//   PREVIEW_URL=http://localhost:3000 node scripts/csp-violations-capture.mjs
//   PREVIEW_URL=https://<preview>.vercel.app node scripts/csp-violations-capture.mjs --vercel
//
// When --vercel is set, requires VERCEL_PROTECTION_BYPASS env to be
// present (cookie-bound bypass for SSO-protected previews — same
// pattern as scripts/baseline-13-1.mjs).
//
// Output: prints a markdown-ish summary to stdout.

import { chromium } from "playwright";

const PREVIEW_URL =
  process.env.PREVIEW_URL ?? "http://localhost:3000";
const VERCEL_BYPASS = process.env.VERCEL_PROTECTION_BYPASS;
const IS_VERCEL = process.argv.includes("--vercel");

if (IS_VERCEL && !VERCEL_BYPASS) {
  console.error(
    "ERROR: --vercel requires VERCEL_PROTECTION_BYPASS env (Vercel SSO cookie bypass token).",
  );
  process.exit(1);
}

const SURFACES = [
  { id: "landing", path: "/", role: null },
  { id: "login", path: "/login", role: null },
  // Gated surfaces — the local capture against `npm run dev`
  // won't be authenticated, so it'll redirect to /login. The
  // Vercel preview run uses Supabase login flow per
  // baseline-13-1.mjs's pattern; for this capture we accept
  // that gated surfaces behind /login redirect to /login and
  // capture the /login violations too. Documenting the limit.
  { id: "play", path: "/play", role: "player" },
  { id: "tournaments-list", path: "/tournaments", role: "player" },
  { id: "t20", path: "/t20", role: "player" },
  { id: "me", path: "/me", role: "player" },
  { id: "manage", path: "/manage/overview", role: "club_admin" },
  { id: "manage-members", path: "/manage/members", role: "club_admin" },
  { id: "platform-clubs", path: "/platform/clubs", role: "super_admin" },
];

function bypassUrl(path) {
  if (!IS_VERCEL) return new URL(path, PREVIEW_URL).toString();
  const u = new URL(path, PREVIEW_URL);
  u.searchParams.set("x-vercel-protection-bypass", VERCEL_BYPASS);
  u.searchParams.set("x-vercel-set-bypass-cookie", "true");
  return u.toString();
}

async function captureFor(page, surface) {
  const violations = [];
  const consoleMessages = [];

  const onViolation = (event) => {
    violations.push({
      directive: event.violatedDirective,
      blocked: event.blockedURI,
      source: event.sourceFile,
      line: event.lineNumber,
    });
  };

  await page.exposeFunction("__cspViolation", onViolation);
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      // @ts-expect-error injected
      window.__cspViolation({
        violatedDirective: e.violatedDirective,
        blockedURI: e.blockedURI,
        sourceFile: e.sourceFile,
        lineNumber: e.lineNumber,
      });
    });
  });

  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("Content-Security-Policy") || text.includes("CSP")) {
      consoleMessages.push(text);
    }
  });

  try {
    await page.goto(bypassUrl(surface.path), {
      waitUntil: "networkidle",
      timeout: 20_000,
    });
  } catch (err) {
    return {
      id: surface.id,
      path: surface.path,
      err: err?.message ?? String(err),
      violations: [],
      consoleMessages: [],
    };
  }
  // Allow a beat for late violations (e.g. lazy-loaded chunks).
  await page.waitForTimeout(1500);

  return {
    id: surface.id,
    path: surface.path,
    err: null,
    violations,
    consoleMessages,
  };
}

async function main() {
  console.log(`[csp-capture] preview: ${PREVIEW_URL}`);
  console.log(`[csp-capture] vercel: ${IS_VERCEL}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const results = [];

  for (const surface of SURFACES) {
    const page = await context.newPage();
    const r = await captureFor(page, surface);
    results.push(r);
    await page.close();
  }

  await browser.close();

  // Summary
  console.log("\n## Summary\n");
  console.log("| Surface | Path | Violations | Note |");
  console.log("|---|---|---:|---|");
  for (const r of results) {
    const note = r.err ? `error: ${r.err.slice(0, 60)}` : "";
    console.log(`| ${r.id} | ${r.path} | ${r.violations.length} | ${note} |`);
  }

  // Dedup violations across all surfaces.
  const dedup = new Map();
  for (const r of results) {
    for (const v of r.violations) {
      const key = `${v.directive}::${v.blocked}`;
      if (!dedup.has(key)) {
        dedup.set(key, { ...v, count: 1, surfaces: new Set([r.id]) });
      } else {
        const d = dedup.get(key);
        d.count++;
        d.surfaces.add(r.id);
      }
    }
  }

  if (dedup.size > 0) {
    console.log("\n## Unique violations (deduped)\n");
    console.log("| Directive | Blocked URI | Count | Surfaces |");
    console.log("|---|---|---:|---|");
    for (const v of dedup.values()) {
      console.log(
        `| ${v.directive} | ${v.blocked} | ${v.count} | ${[...v.surfaces].join(", ")} |`,
      );
    }
  } else {
    console.log("\n## No CSP violations captured ✓\n");
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
