// Quick diagnostic: does Supabase login persist past the /login page on the
// Vercel preview when both Vercel-bypass + Supabase cookies are layered?
//
// Logs the URL Playwright lands on after submitting the login form, then
// navigates to /play and prints that URL too. Captures cookies for inspection.

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

const PREVIEW = "https://handibowls-chsc1zn6z-andrews-projects-a0c14c4f.vercel.app";
const BYPASS = process.env.VERCEL_PROTECTION_BYPASS;
const PASSWORD = "dev-password-12345";

function bypassUrl(path) {
  const u = new URL(path, PREVIEW);
  u.searchParams.set("x-vercel-protection-bypass", BYPASS);
  u.searchParams.set("x-vercel-set-bypass-cookie", "true");
  return u.toString();
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") {
    console.log(`    [console:${msg.type()}]`, msg.text().slice(0, 200));
  }
});
page.on("response", (resp) => {
  const u = resp.url();
  if (u.includes("auth/v1") || u.includes("/login") || u.includes("/play") || resp.status() >= 400) {
    console.log(`    [resp ${resp.status()}]`, u.slice(0, 120));
  }
});
page.on("requestfailed", (req) => {
  console.log(`    [reqfail]`, req.url().slice(0, 100), req.failure()?.errorText);
});

console.log(">>> goto /login");
await page.goto(bypassUrl("/login"), { waitUntil: "domcontentloaded" });
console.log("    landed:", page.url().slice(0, 90));

await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
await page.fill('input[type="email"]', "player@demo.local");
await page.fill('input[type="password"]', PASSWORD);

console.log(">>> submit form");
await page.click('button[type="submit"]');
try {
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30_000 });
} catch (e) {
  console.log("    waitForURL TIMEOUT:", e.message.slice(0, 100));
}
console.log("    post-submit url:", page.url().slice(0, 120));

const banner = await page.evaluate(() => {
  const b = document.querySelector('[role="alert"], [data-form-banner], .form-banner');
  return b?.textContent?.slice(0, 240) ?? null;
});
console.log("    banner:", banner);
const allText = await page.evaluate(() => document.body.innerText.slice(0, 500));
console.log("    body excerpt:", allText.replace(/\s+/g, " ").slice(0, 400));

const cookies = await ctx.cookies();
const sbCookies = cookies.filter((c) => c.name.includes("sb-") || c.name.includes("supabase"));
const vCookies = cookies.filter((c) => c.name.includes("vercel"));
console.log("    sb cookies:", sbCookies.length, sbCookies.map((c) => c.name));
console.log("    vercel cookies:", vCookies.length, vCookies.map((c) => c.name));

console.log(">>> goto /play (with bypass)");
await page.goto(bypassUrl("/play"), { waitUntil: "domcontentloaded" });
console.log("    landed:", page.url().slice(0, 120));

console.log(">>> goto /play (NO bypass query — only cookie)");
await page.goto(`${PREVIEW}/play`, { waitUntil: "domcontentloaded" });
console.log("    landed:", page.url().slice(0, 120));

const title = await page.title();
const h1 = await page.evaluate(() => document.querySelector("h1")?.textContent?.slice(0, 80));
console.log("    title:", title);
console.log("    h1:", h1);

await browser.close();
