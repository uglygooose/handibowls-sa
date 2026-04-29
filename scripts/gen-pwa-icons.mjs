// Generates placeholder PWA icons (192/512 + maskable variants) into
// public/icons/, plus app/apple-icon.png (180x180) consumed by Next 16's
// App Router convention to auto-emit `<link rel="apple-touch-icon">`.
// Solid-colour circular mark on a padded safe-zone background
// — good enough to satisfy the manifest + Lighthouse maskable checks.
// Replace with final branded artwork before launch.

import { mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "..", "public", "icons");
const appDir = resolve(__dirname, "..", "app");
await mkdir(outDir, { recursive: true });

const CORE_BLACK = "#0A0A0A";
const BONE = "#FAFAF7";
const ATOMIC_RED = "#D7261E";

function markSvg(size, { background = BONE, fg = CORE_BLACK, accent = ATOMIC_RED, bleed = 0 } = {}) {
  // Maskable icons need a padded safe zone (about 80% diameter). For regular
  // "any" purpose icons the mark can fill the square; for maskable we shrink
  // the inner art and let the background bleed.
  const r = bleed ? size * 0.35 : size * 0.45;
  const accentR = bleed ? size * 0.12 : size * 0.15;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="${background}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${fg}"/>
      <circle cx="${size * 0.62}" cy="${size * 0.38}" r="${accentR}" fill="${accent}"/>
    </svg>
  `;
}

const targets = [
  { name: "icon-192.png", size: 192, opts: {} },
  { name: "icon-512.png", size: 512, opts: {} },
  { name: "maskable-192.png", size: 192, opts: { bleed: 1 } },
  { name: "maskable-512.png", size: 512, opts: { bleed: 1 } },
];

for (const { name, size, opts } of targets) {
  const svg = markSvg(size, opts);
  const out = resolve(outDir, name);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("wrote", out);
}

// app/apple-icon.png — 180x180, full-bleed (no maskable safe zone).
// iOS rounds the corners itself; we want the mark to fill the square.
// The unbleed mark variant is the right shape — same circle composition
// as icon-192/512, scaled to 180.
{
  const svg = markSvg(180);
  const out = resolve(appDir, "apple-icon.png");
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("wrote", out);
}
