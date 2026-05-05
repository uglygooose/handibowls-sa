// Phase 13 / 13-8 / Batch A — Demo seed shared helpers.
//
// DEMO SUPABASE ONLY. Never run against a Supabase project that
// contains real pilot/customer data. There is no production-safety
// check — we trust the operator to know which environment they're
// targeting. See docs/DEMO_LOGINS.md for the operator handoff.
//
// Tagging strategy: deterministic naming + FK chain off demo auth
// users (`*@demo.local` + `super@handibowls.local`). The reset
// script wipes by slug-prefix (`demo-` for clubs) and email-pattern
// (for auth.users + their cascade chain). Districts + rubrics are
// migration-seeded reference data and are NEVER touched by reset.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { Database } from "../../types/database.types";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Local .env.test loader. Mirrors scripts/seed-dev-users.ts so the
// seed scripts share a single env-resolution path.
function loadEnv() {
  const envPath = resolve(__dirname, "..", "..", ".env.test");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

loadEnv();

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY missing. Run `npx supabase status` and populate .env.test.",
  );
  process.exit(1);
}

// Demo accounts only — never reuse this pattern for real users.
// Aligned with the existing scripts/seed-dev-users.ts:DEV_PASSWORD
// convention (fixed dev-password for demo-account convenience). This
// constant is committed to git intentionally — the demo Supabase
// project is throwaway.
export const DEMO_PASSWORD = "DemoPass2026!";

// Email patterns the reset script uses to identify demo auth users.
// Both Stage 1 (preservation filter — keep matching) and Stage 2
// (deletion filter — delete matching) use this set.
//
// `@handibowls.local` covers `super@handibowls.local` plus any future
// platform-level demo accounts that land at this domain (matches the
// brief's `%@handibowls.local` framing).
export const DEMO_EMAIL_PATTERNS = [
  "@demo.local",
  "@handibowls.local",
] as const;

export function isDemoEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").toLowerCase();
  return DEMO_EMAIL_PATTERNS.some((pattern) => e.endsWith(pattern));
}

// Slug prefixes the reset script uses to identify demo clubs.
// "pinelands-bc" is listed explicitly because it doesn't carry the
// "demo-" prefix (operator-named real-feeling cross-club fixture).
export const DEMO_CLUB_SLUG_PATTERNS = {
  prefixes: ["demo-"] as const,
  exact: ["pinelands-bc"] as const,
};

export type Admin = SupabaseClient<Database>;

export function admin(): Admin {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Slugify a club name into a URL-stable lowercase-hyphenated form.
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Look up an auth user id by email. The Auth Admin API's listUsers is
// paginated and the demo Supabase project may have accumulated RLS-
// test users + dev-seed users beyond the default page size, so we
// paginate until exhaustion. Caches the page list per call so repeated
// findUserId in a single seed run stays fast.
export async function findUserId(
  client: Admin,
  email: string,
): Promise<string | null> {
  const all = await listAllAuthUsers(client);
  return (
    all.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null
  );
}

export async function listAllAuthUsers(client: Admin) {
  const out: Array<{ id: string; email?: string }> = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < perPage) break;
    page++;
    if (page > 100) {
      throw new Error("listAllAuthUsers: pagination guard tripped (>100 pages)");
    }
  }
  return out;
}

// Pretty-print a section header to the console — keeps the seed run
// log readable when running 6+ fixture modules in sequence.
export function logSection(title: string): void {
  const bar = "─".repeat(60);
  console.log(`\n${bar}\n  ${title}\n${bar}`);
}
