#!/usr/bin/env node
// Phase 12 / 12-5 — per-route Client Component bundle audit.
//
// Next 16 + Turbopack's `next experimental-analyze` produces an
// interactive browser view, not headless JSON. This script does
// the same job for the four player routes we care about by
// reading `.next/server/app/<route>/page_client-reference-manifest.js`
// (the manifest of Client Components shipped to each route),
// extracting the referenced chunk paths, and summing their disk
// sizes.
//
// Also flags two specific dependencies the L67 drift entry
// hypothesised about:
//
//   - yoga-layout (1.4MB wasm dep of @react-pdf/renderer) —
//     should be gated behind the PDF preview only.
//
//   - dexie (95KB IndexedDB wrapper, scorecard outbox) — should
//     be scorecard-only OR lazy-mounted, not eagerly loaded on
//     every player route.
//
// Run once after `npm run build` to capture a baseline; re-run
// after each lazy-load / gate commit to see the delta.

import { readFileSync, statSync, readdirSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";

const NEXT = ".next";
const STATIC_CHUNKS = `${NEXT}/static/chunks`;

// Routes audited. Add new entries here if scope expands.
const ROUTES = {
  "/play": "(player)/(gated)/play",
  "/book": "(player)/(gated)/book",
  "/tournaments": "(player)/(gated)/tournaments",
  "/me": "(player)/(gated)/me",
  "/tournaments/[id]/matches/[matchId]": "(player)/(gated)/tournaments/[id]/matches/[matchId]",
  "/manage/tournaments/[id]/pdf": "(club-admin)/manage/tournaments/[id]/pdf",
};

// Yoga chunk filename — currently static (Turbopack hashing is
// deterministic across builds). If a future build changes it,
// detect via grep for the wasm-base64 module instead.
const YOGA_CHUNK = "01ou3_s~.y2oi.js";

function findDexieChunks() {
  const out = new Set();
  for (const f of readdirSync(STATIC_CHUNKS)) {
    if (!f.endsWith(".js")) continue;
    const data = readFileSync(`${STATIC_CHUNKS}/${f}`, "utf8");
    if (data.includes("Dexie") || data.includes("matchEnds")) {
      out.add(f);
    }
  }
  return out;
}

function parseClientManifest(path) {
  if (!existsSync(path)) return new Set();
  const text = readFileSync(path, "utf8");
  return new Set([...text.matchAll(/"(static\/chunks\/[^"]+\.js)"/g)].map((m) => m[1]));
}

const dexieChunks = findDexieChunks();

console.log(`yoga chunk: ${YOGA_CHUNK} (${(statSync(`${NEXT}/static/chunks/${YOGA_CHUNK}`).size / 1024).toFixed(0)} KiB)`);
console.log(`dexie chunks: ${[...dexieChunks].join(", ")}`);
console.log();
console.log("route".padEnd(50) + " chunks   KiB  yoga  dexie");
console.log("-".repeat(80));

for (const [label, path] of Object.entries(ROUTES)) {
  const manifest = `${NEXT}/server/app/${path}/page_client-reference-manifest.js`;
  const chunks = parseClientManifest(manifest);
  let total = 0;
  for (const c of chunks) {
    const p = `${NEXT}/${c}`;
    if (existsSync(p)) total += statSync(p).size;
  }
  const hasYoga = [...chunks].some((c) => c.includes(YOGA_CHUNK));
  const hasDexie = [...chunks].some((c) => [...dexieChunks].some((d) => c.includes(d)));
  const yogaCol = hasYoga ? "YES " : "no  ";
  const dexieCol = hasDexie ? "YES" : "no";
  console.log(
    label.padEnd(50) +
      chunks.size.toString().padStart(7) +
      ` ${(total / 1024).toFixed(0).padStart(5)}   ${yogaCol}  ${dexieCol}`,
  );
}
