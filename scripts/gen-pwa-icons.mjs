// Generates the canonical HandiBowls favicon + PWA icon set per the
// design source bundle (handibowls/project/HandiBowls Logo.html).
//
// Two-tier mark per design spec:
//   • Simple — disc + concentric jack-target + highlight, no speckle.
//     Used for ≤64px sizes (speckle becomes mud at small render sizes).
//   • Rich — adds a 90-dot speckle field clipped to the disc + a radial
//     gradient shine. Used for 180/512 sizes where the texture reads.
//
// Output paths:
//   public/favicon.svg                    (simple, vector source)
//   public/favicon-{16,32,48,64}.png      (simple, raster fallbacks)
//   public/icons/icon-{192,512}.png       (rich, PWA "any" purpose)
//   public/icons/maskable-{192,512}.png   (rich + bleed safe zone)
//   app/apple-icon.png                    (rich at 180px, full-bleed)
//
// Theme-color #08BB00 (Henselite green) per the Phase 13 / 13-9
// partnership rebrand. Earlier revisions used atomic-red.
//
// Run via `npm run gen:icons`.

import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const PUBLIC = resolve(REPO, "public");
const PUBLIC_ICONS = resolve(PUBLIC, "icons");
const APP = resolve(REPO, "app");

const HENSELITE_GREEN = "#08BB00";
const INK = "#0A0A0A";
// Emblem rings + centre dot must be ink — white at full strength is 2.6:1
// vs Henselite green (fails WCAG 1.4.11 non-text 3:1). Ink at the same
// stroke-opacities reads as a translucent engraving on the green disc.
const EMBLEM_INK = "#0A0A0A";
// Shine/highlight stays white — purely decorative gloss; not subject to
// contrast rules and visually wrong as ink.
const SHINE = "#FFFFFF";

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Simple variant — disc + concentric jack-target rings + highlight.
// 100×100 viewBox; cx/cy = 50; disc r = 42 by default.
function simpleSvg({ size = 100, includeXmlns = true } = {}) {
  const xmlns = includeXmlns ? ' xmlns="http://www.w3.org/2000/svg"' : "";
  return `<svg${xmlns} width="${size}" height="${size}" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="42" fill="${HENSELITE_GREEN}"/>
  <circle cx="50" cy="50" r="26" fill="none" stroke="${EMBLEM_INK}" stroke-opacity="0.595" stroke-width="2.2"/>
  <circle cx="50" cy="50" r="14" fill="none" stroke="${EMBLEM_INK}" stroke-opacity="0.4675" stroke-width="1.8"/>
  <circle cx="50" cy="50" r="4.5" fill="${EMBLEM_INK}" fill-opacity="0.85"/>
  <ellipse cx="36" cy="32" rx="14" ry="9" fill="${SHINE}" fill-opacity="0.18"/>
</svg>`;
}

// Rich variant — adds a 90-dot deterministic speckle field clipped to the
// disc, plus a radial-gradient shine. `bleed` shrinks the inner mark to a
// safe zone (used by maskable PWA icons). `bg` paints a rounded-square
// background; pass null to leave transparent.
function richSvg({ size = 100, bleed = false, bg = INK } = {}) {
  const discR = bleed ? 33 : 42;
  const ring1R = discR * 0.62;
  const ring2R = discR * 0.33;
  const rand = mulberry32(hashSeed("hb-favicon"));
  const dots = [];
  for (let i = 0; i < 90; i++) {
    const r = Math.sqrt(rand()) * (discR - 4);
    const t = rand() * Math.PI * 2;
    dots.push({
      x: 50 + Math.cos(t) * r,
      y: 50 + Math.sin(t) * r,
      s: 0.5 + rand() * 1.6,
      useA: rand() < 0.5,
      o: 0.45 + rand() * 0.45,
    });
  }
  const speckle = dots.map((d) => `<circle cx="${d.x.toFixed(2)}" cy="${d.y.toFixed(2)}" r="${d.s.toFixed(2)}" fill="${d.useA ? INK : SHINE}" opacity="${d.o.toFixed(2)}"/>`).join("");
  const bgRect = bg ? `<rect x="0" y="0" width="100" height="100" rx="22" fill="${bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <clipPath id="hb-fav-clip"><circle cx="50" cy="50" r="${discR}"/></clipPath>
    <radialGradient id="hb-fav-shine" cx="32%" cy="26%" r="75%">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.5"/>
      <stop offset="22%" stop-color="#fff" stop-opacity="0.16"/>
      <stop offset="55%" stop-color="#fff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.25"/>
    </radialGradient>
  </defs>
  ${bgRect}
  <circle cx="50" cy="50" r="${discR}" fill="${HENSELITE_GREEN}"/>
  <g clip-path="url(#hb-fav-clip)">${speckle}</g>
  <circle cx="50" cy="50" r="${discR}" fill="url(#hb-fav-shine)"/>
  <circle cx="50" cy="50" r="${ring1R.toFixed(2)}" fill="none" stroke="${EMBLEM_INK}" stroke-opacity="0.595" stroke-width="2.2"/>
  <circle cx="50" cy="50" r="${ring2R.toFixed(2)}" fill="none" stroke="${EMBLEM_INK}" stroke-opacity="0.4675" stroke-width="1.8"/>
  <circle cx="50" cy="50" r="4.5" fill="${EMBLEM_INK}" fill-opacity="0.85"/>
  <ellipse cx="36" cy="32" rx="14" ry="9" fill="${SHINE}" fill-opacity="0.18"/>
</svg>`;
}

await mkdir(PUBLIC_ICONS, { recursive: true });

// 1. Vector source (simple variant) — also serves at /favicon.svg.
{
  const svg = simpleSvg({ size: 100 });
  const out = resolve(PUBLIC, "favicon.svg");
  await writeFile(out, svg, "utf8");
  console.log("wrote", out);
}

// 2. Sized PNG fallbacks (simple variant) for legacy browsers.
for (const size of [16, 32, 48, 64]) {
  const svg = simpleSvg({ size });
  const out = resolve(PUBLIC, `favicon-${size}.png`);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("wrote", out);
}

// 3. PWA icons (rich variant) — "any" purpose, full-bleed disc on dark bg.
for (const size of [192, 512]) {
  const svg = richSvg({ size });
  const out = resolve(PUBLIC_ICONS, `icon-${size}.png`);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("wrote", out);
}

// 4. Maskable PWA icons — same rich variant but inner mark inset to a safe
//    zone so the platform can crop into circles / rounded squares without
//    clipping the recognizable jack target.
for (const size of [192, 512]) {
  const svg = richSvg({ size, bleed: true });
  const out = resolve(PUBLIC_ICONS, `maskable-${size}.png`);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("wrote", out);
}

// 5. Apple touch icon — Next.js conventional file at app/apple-icon.png.
//    180×180; iOS rounds the corners itself, so the dark rounded-square bg
//    in richSvg ends up rendered as a rounded-square through the iOS mask.
{
  const svg = richSvg({ size: 180 });
  const out = resolve(APP, "apple-icon.png");
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("wrote", out);
}
