// READ-ONLY DIAGNOSTIC — Phase 13 / 13-1 / pre-M3 offline-scoring reality audit.
//
// Drives the captain-side offline-scoring flow end-to-end against a Vercel
// preview. Reports the actual behaviour of each step in the contract Phase 8c+8d
// claimed to ship: Dexie outbox fill on offline +/- clicks, scorecard
// rehydrate-while-offline, auto-flush on reconnect, server state reconciliation.
//
// NO COMMITS, NO FIXES, NO STATE CHANGES on the user side. This script DOES
// write match_ends rows on the cloud Supabase (any successful test write
// creates persistent rows). Test data clean-up not in scope — these rows
// accumulate against the demo tournament. If accumulation becomes noisy,
// re-seed via npm run seed:dev:t20 --reset OR drop test ends manually.

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

function loadEnv() {
  for (const p of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(resolve(REPO_ROOT, p), "utf8");
      for (const line of txt.split("\n")) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {}
  }
}
loadEnv();

const PREVIEW = process.env.PREVIEW_URL ?? "https://handibowls-ki59ji1t1-andrews-projects-a0c14c4f.vercel.app";
const BYPASS = process.env.VERCEL_PROTECTION_BYPASS;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = "dev-password-12345";

if (!BYPASS) throw new Error("VERCEL_PROTECTION_BYPASS env required");

const sb = createSupabaseClient(SUPABASE_URL, SERVICE_ROLE);

function bypassUrl(path) {
  const u = new URL(path, PREVIEW);
  u.searchParams.set("x-vercel-protection-bypass", BYPASS);
  u.searchParams.set("x-vercel-set-bypass-cookie", "true");
  return u.toString();
}

async function loginAs(page, email) {
  await page.goto(bypassUrl("/login"), { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30_000 });
}

async function findScorecardMatch(page) {
  await page.goto(bypassUrl("/tournaments"), { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 20_000 });

  // List all tournament-detail hrefs surfaced on the player /tournaments page.
  const tournamentHrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a"))
      .map((a) => a.getAttribute("href") ?? "")
      .filter((h) => /^\/tournaments\/[0-9a-f]{8}-[0-9a-f-]+$/.test(h)),
  );
  console.log(`    [debug] tournament hrefs on /tournaments:`, tournamentHrefs);

  // Iterate each tournament — first one with a match link wins. The player's
  // entered tournament can be in either entered or available state, and only
  // the entered ones surface a scorecard link on detail.
  for (const tHref of tournamentHrefs) {
    await page.goto(bypassUrl(tHref), { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 });
    const matchHref = await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll("a")).find((el) => {
        const h = el.getAttribute("href") ?? "";
        return h.includes("/matches/");
      });
      return a?.getAttribute("href") ?? null;
    });
    if (matchHref) {
      console.log(`    [debug] found match link on ${tHref}`);
      return matchHref;
    }
  }
  return null;
}

async function getMatchEndsCountFromDb(matchId) {
  const { count, error } = await sb
    .from("match_ends")
    .select("*", { count: "exact", head: true })
    .eq("match_id", matchId);
  if (error) throw error;
  return count ?? 0;
}

async function listMatchEnds(matchId) {
  const { data, error } = await sb
    .from("match_ends")
    .select("end_number, home_shots, away_shots, updated_at")
    .eq("match_id", matchId)
    .order("end_number");
  if (error) throw error;
  return data;
}

async function readDexieState(page) {
  // Returns null if IDB access is denied (post-error-state from a failed
  // reload), otherwise the dexie state.
  return page.evaluate(async () => {
    if (typeof window === "undefined") return null;
    if (typeof indexedDB === "undefined") return { idbAccessDenied: true };
    return new Promise((resolve) => {
      let resolved = false;
      const safeResolve = (v) => {
        if (!resolved) {
          resolved = true;
          resolve(v);
        }
      };
      let req;
      try {
        req = indexedDB.open("handibowls");
      } catch (e) {
        return safeResolve({ idbAccessDenied: true, err: String(e).slice(0, 100) });
      }
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("matchEnds")) {
          db.close();
          safeResolve({ exists: true, matchEnds: [] });
          return;
        }
        const tx = db.transaction("matchEnds", "readonly");
        const store = tx.objectStore("matchEnds");
        const all = store.getAll();
        all.onsuccess = () => {
          db.close();
          safeResolve({
            exists: true,
            matchEnds: all.result.map((r) => ({
              matchId: r.matchId,
              endNumber: r.endNumber,
              homeShots: r.homeShots,
              awayShots: r.awayShots,
              syncStatus: r.syncStatus,
            })),
          });
        };
        all.onerror = () => {
          db.close();
          safeResolve({ exists: true, matchEnds: [], readErr: true });
        };
      };
      req.onerror = () => safeResolve({ exists: false, openErr: String(req.error).slice(0, 100) });
      req.onblocked = () => safeResolve({ exists: false, blocked: true });
    });
  });
}

async function checkServiceWorkerStatus(page) {
  return page.evaluate(async () => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return { unsupported: true };
    }
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return { registered: false };
    return {
      registered: true,
      scope: reg.scope,
      activeState: reg.active?.state ?? null,
      installingState: reg.installing?.state ?? null,
      waitingState: reg.waiting?.state ?? null,
    };
  });
}

async function readSyncBadge(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-slot="offline-sync-badge"]');
    return el
      ? { state: el.getAttribute("data-state"), label: el.textContent?.trim() }
      : null;
  });
}

const REPORT = [];
function log(line) {
  console.log(line);
  REPORT.push(line);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Surface console errors as evidence
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`[browser:err] ${msg.text().slice(0, 240)}`);
    }
  });
  page.on("pageerror", (err) => {
    console.log(`[pageerror] ${err.message.slice(0, 240)}`);
  });

  log(`>>> preview: ${PREVIEW}`);

  // ---- Step 0: login as player ------------------------------------------
  log(">>> Step 0: login as player@demo.local");
  await loginAs(page, "player@demo.local");
  log(`    landed: ${page.url().slice(0, 120)}`);

  // ---- Step 1: locate scorecard route -----------------------------------
  log(">>> Step 1: locate a scorecard route the player can reach");
  const scorecardHref = await findScorecardMatch(page);
  if (!scorecardHref) {
    log("    FAIL: no scorecard match link found from /tournaments");
    await browser.close();
    return;
  }
  log(`    match href: ${scorecardHref}`);
  const matchIdMatch = scorecardHref.match(/\/matches\/([0-9a-f-]+)/);
  const matchId = matchIdMatch?.[1];
  if (!matchId) {
    log("    FAIL: couldn't parse match_id from href");
    await browser.close();
    return;
  }
  log(`    match_id: ${matchId}`);

  // Snapshot server-side match_ends count before any test writes
  const dbCountBefore = await getMatchEndsCountFromDb(matchId);
  log(`    server match_ends rows BEFORE test: ${dbCountBefore}`);

  // ---- Step 2: open scorecard online, observe initial state -------------
  log(">>> Step 2: open scorecard online + check initial state");
  await page.goto(bypassUrl(scorecardHref), { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
  const finalUrl = page.url();
  log(`    landed: ${finalUrl.slice(0, 120)}`);
  if (!finalUrl.includes("/matches/")) {
    log(`    FAIL: redirected away from scorecard — likely permissions / no participation`);
  }

  const badgeOnline = await readSyncBadge(page);
  log(`    sync badge online: ${JSON.stringify(badgeOnline)}`);
  const dexieOnline = await readDexieState(page);
  log(`    dexie state online: ${JSON.stringify(dexieOnline?.exists ? { exists: true, ends: dexieOnline.matchEnds.length } : dexieOnline)}`);
  const swStatus = await checkServiceWorkerStatus(page);
  log(`    service-worker status: ${JSON.stringify(swStatus)}`);
  // Give the SW a chance to take control + cache the page if it just registered
  await page.waitForTimeout(2000);

  // Find scoring buttons (the +/- pair). Scorecard.tsx uses data-slot or
  // explicit buttons.
  const scoringButtons = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("button"));
    return all
      .map((b) => ({
        text: b.textContent?.trim().slice(0, 30) ?? "",
        ariaLabel: b.getAttribute("aria-label") ?? "",
        dataSlot: b.getAttribute("data-slot") ?? "",
        dataTestid: b.getAttribute("data-testid") ?? "",
        disabled: b.disabled,
      }))
      .filter(
        (b) =>
          b.ariaLabel.toLowerCase().includes("score") ||
          b.ariaLabel.toLowerCase().includes("home") ||
          b.ariaLabel.toLowerCase().includes("away") ||
          b.ariaLabel.toLowerCase().includes("shot") ||
          b.dataSlot.includes("score") ||
          b.dataTestid.includes("score") ||
          b.dataTestid.includes("inc") ||
          b.dataTestid.includes("dec") ||
          /^[+-]$/.test(b.text)
      )
      .slice(0, 30);
  });
  log(`    scoring-button candidates (${scoringButtons.length}):`);
  for (const b of scoringButtons.slice(0, 10)) {
    log(`      • ${JSON.stringify(b)}`);
  }
  if (scoringButtons.length === 0) {
    log(`    NOTE: no obvious +/- scoring buttons surfaced via aria/data heuristics — may need direct DOM inspection`);
  }

  // ---- Step 3: go offline -----------------------------------------------
  log(">>> Step 3: set offline");
  await ctx.setOffline(true);
  await page.evaluate(() => {
    if (typeof navigator !== "undefined" && "onLine" in navigator) {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    }
    window.dispatchEvent(new Event("offline"));
  });

  // ---- Step 4: try to score 3 ends offline ------------------------------
  log(">>> Step 4: attempt to score 3 ends offline");
  // Dump ALL stepper-btn buttons + neighbouring context for debugging
  const allSteppers = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-slot="stepper-btn"]')).map((b) => ({
      ariaLabel: b.getAttribute("aria-label"),
      disabled: b.disabled,
      visible: !!(b.offsetParent ?? b.getClientRects().length > 0),
    })),
  );
  log(`    [debug] all stepper buttons: ${JSON.stringify(allSteppers)}`);

  const tested = [];
  for (let i = 0; i < 3; i++) {
    const clicked = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('[data-slot="stepper-btn"]'));
      // Pick the first ENABLED increase button (away or home — doesn't matter
      // for outbox-fill verification).
      const pick = all.find((b) => {
        const aria = (b.getAttribute("aria-label") ?? "").toLowerCase();
        return !b.disabled && aria.includes("increase");
      });
      if (!pick) return null;
      pick.click();
      return {
        clickedAria: pick.getAttribute("aria-label"),
        clickedSlot: pick.getAttribute("data-slot"),
      };
    });
    tested.push({ end: i + 1, clicked });
    await page.waitForTimeout(600);
  }
  log(`    score attempts: ${JSON.stringify(tested)}`);

  // Per Scorecard.tsx:220-251, +/- steppers only update component state;
  // the Dexie write happens in commitEnd() which fires after a confirm
  // sheet. The one-tap path that DOES write directly is commitPeel /
  // commitSkip (Scorecard.tsx:261-290) — both call upsertMatchEndLocal
  // immediately and call flushNow().
  //
  // Try Mark peel (one-tap, writes 0/0 to Dexie directly).
  const peelClick = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll("button")).filter((b) => {
      const txt = (b.textContent ?? "").trim().toLowerCase();
      const aria = (b.getAttribute("aria-label") ?? "").toLowerCase();
      return !b.disabled && (txt === "mark peel" || aria.includes("mark peel") || txt.includes("peel"));
    });
    if (candidates.length === 0) return { found: false };
    candidates[0].click();
    return { found: true, text: candidates[0].textContent?.trim() };
  });
  log(`    [debug] Mark peel button click: ${JSON.stringify(peelClick)}`);
  await page.waitForTimeout(1500);
  // Dump all visible buttons for context
  const allButtons = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .filter((b) => b.offsetParent !== null)
      .map((b) => ({
        text: (b.textContent ?? "").trim().slice(0, 30),
        aria: b.getAttribute("aria-label"),
        slot: b.getAttribute("data-slot"),
        disabled: b.disabled,
      }))
      .slice(0, 25),
  );
  log(`    [debug] visible buttons after End-complete click:`);
  for (const b of allButtons) log(`      • ${JSON.stringify(b)}`);

  const dexieAfterOffline = await readDexieState(page);
  log(`    dexie state after offline scoring: ${JSON.stringify(dexieAfterOffline?.exists ? { ends: dexieAfterOffline.matchEnds } : dexieAfterOffline)}`);
  const badgeOffline = await readSyncBadge(page);
  log(`    sync badge after offline scoring: ${JSON.stringify(badgeOffline)}`);

  // ---- Step 5: reload while offline -------------------------------------
  log(">>> Step 5: reload while offline + verify scorecard rehydrates");
  try {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
    const reloadedUrl = page.url();
    const reloadedTitle = await page.title();
    log(`    reload landed: ${reloadedUrl.slice(0, 120)} title="${reloadedTitle}"`);
    const reloadedH1 = await page.evaluate(() => document.querySelector("h1")?.textContent?.slice(0, 80));
    log(`    reload h1: "${reloadedH1}"`);
    const dexieAfterReload = await readDexieState(page);
    log(`    dexie state after reload: ${JSON.stringify(dexieAfterReload?.exists ? { ends: dexieAfterReload.matchEnds.length } : dexieAfterReload)}`);
  } catch (e) {
    log(`    reload FAIL: ${e.message.slice(0, 200)}`);
  }

  // ---- Step 6: back online + observe flush ------------------------------
  log(">>> Step 6: set online + observe outbox flush");
  await ctx.setOffline(false);
  await page.evaluate(() => {
    if (typeof navigator !== "undefined" && "onLine" in navigator) {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    }
    window.dispatchEvent(new Event("online"));
  });
  await page.waitForTimeout(8_000);
  const dexieAfterOnline = await readDexieState(page);
  log(`    dexie state after reconnect (waited 8s): ${JSON.stringify(dexieAfterOnline?.exists ? { ends: dexieAfterOnline.matchEnds } : dexieAfterOnline)}`);
  const badgeOnlineFinal = await readSyncBadge(page);
  log(`    sync badge after reconnect: ${JSON.stringify(badgeOnlineFinal)}`);

  // ---- Step 7: verify server state --------------------------------------
  log(">>> Step 7: verify server-side match_ends");
  const dbCountAfter = await getMatchEndsCountFromDb(matchId);
  const dbRowsAfter = await listMatchEnds(matchId);
  log(`    server match_ends count: ${dbCountBefore} → ${dbCountAfter}`);
  log(`    server rows: ${JSON.stringify(dbRowsAfter)}`);

  await browser.close();

  // ---- Verdict heuristic ------------------------------------------------
  const wroteToDexie = (dexieAfterOffline?.matchEnds?.length ?? 0) > (dexieOnline?.matchEnds?.length ?? 0);
  const reachedScorecard = finalUrl.includes("/matches/");
  log("");
  log("=== VERDICT INPUTS ===");
  log(`  reached scorecard route:        ${reachedScorecard}`);
  log(`  scoring buttons found:          ${scoringButtons.length}`);
  log(`  dexie wrote rows offline:       ${wroteToDexie}`);
  log(`  reload while offline rendered:  see Step 5 evidence above`);
  log(`  server reconciled after online: ${dbCountAfter > dbCountBefore}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
