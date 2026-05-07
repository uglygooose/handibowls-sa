// Generates the canonical HandiBowls favicon + PWA icon set against
// the Phase 15 co-brand bowl glyph (Henselite green bowl + speckle +
// bone disc + Henselite mark). Two variants per the design source:
//
//   • Knockout (size < 64) — bowl + dense speckle + bone disc covering
//     the centre + Henselite mark inside the disc. Used for favicon
//     fallbacks (16/32/48/64) where the full halo composition gets
//     muddy.
//
//   • Halo & Rest (size ≥ 64) — bowl + sparse larger speckle around
//     a clear centre + Henselite mark resting on the bowl surface +
//     thin engraved ring. Used for PWA (192/512), maskable, and apple-
//     icon (180).
//
// Bowl base is HENSELITE_GREEN (the Phase 13/13-9 partnership default).
// Icons are theme-stable — they don't follow the active CSS theme;
// they ARE the brand mark. Per-club theming applies only to in-app
// chrome, not to the install/social presence.
//
// The Henselite mark PNG is read at script runtime, base64-encoded,
// and inlined into the SVG via a `data:image/png;base64,…` href so
// sharp/librsvg can rasterise without needing to resolve external
// references.
//
// Output paths:
//   public/favicon.svg                    (knockout, vector source)
//   public/favicon-{16,32,48,64}.png      (knockout, raster fallbacks)
//   public/icons/icon-{192,512}.png       (halo, PWA "any" purpose)
//   public/icons/maskable-{192,512}.png   (halo + bleed safe zone)
//   app/apple-icon.png                    (halo at 180px)
//
// Run via `npm run gen:icons`.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const PUBLIC = resolve(REPO, "public");
const PUBLIC_ICONS = resolve(PUBLIC, "icons");
const APP = resolve(REPO, "app");
const HENSELITE_DIR = resolve(PUBLIC, "brand/henselite");

const HENSELITE_GREEN = "#08BB00";
const INK = "#0A0A0A";
const BONE = "#FAFAF7";

// Henselite mark assets are derived by scripts/derive-henselite-mark.mjs.
// We base64-encode at build time so the rasteriser doesn't need to
// resolve external references.
async function loadMarkDataUri(filename) {
  const buf = await readFile(resolve(HENSELITE_DIR, filename));
  return `data:image/png;base64,${buf.toString("base64")}`;
}

// Mulberry32 + hashSeed — match the runtime speckle algorithm in
// lib/brand/speckle.ts byte-for-byte. Duplicated here because the
// runtime is .ts and this script is .mjs; the algorithm is small and
// the icons are static.
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function generateSpeckles({
  seed,
  count,
  radius,
  colors,
  sizeMin = 0.45,
  sizeMax = 2.3,
  cx = 50,
  cy = 50,
  avoidR = 0,
}) {
  const rand = mulberry32(seed);
  const dots = [];
  let attempts = 0;
  const avoidR2 = avoidR * avoidR;
  while (dots.length < count && attempts < count * 4) {
    attempts++;
    const r = Math.sqrt(rand()) * radius * 0.96;
    const theta = rand() * Math.PI * 2;
    const x = cx + Math.cos(theta) * r;
    const y = cy + Math.sin(theta) * r;
    if (avoidR > 0) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < avoidR2) continue;
    }
    const size = sizeMin + rand() * (sizeMax - sizeMin);
    const colorIdx = Math.floor(rand() * colors.length);
    const shape = rand() < 0.18 ? "streak" : "dot";
    const angle = rand() * 360;
    dots.push({
      x,
      y,
      size,
      color: colors[colorIdx],
      shape,
      angle,
      opacity: 0.55 + rand() * 0.45,
    });
  }
  return dots;
}

// Pre-compute the two datasets once. Same fixed seeds as the runtime
// component so the icon's speckle pattern matches in-app rendering.
const SPECKLE_KNOCKOUT = generateSpeckles({
  seed: hashSeed("c2-handi"),
  count: 240,
  radius: 48,
  colors: [INK, BONE],
  avoidR: 0,
});
const SPECKLE_HALO = generateSpeckles({
  seed: hashSeed("c3-handi"),
  count: 90,
  radius: 48,
  colors: [INK, BONE],
  sizeMin: 0.8,
  sizeMax: 3.0,
  avoidR: 22,
});

function dotsSvg(dots, sizePx) {
  const ratio = Math.max(0.18, Math.min(1, sizePx / 96));
  const sorted = [...dots].sort((a, b) => b.size - a.size);
  const keep = Math.max(8, Math.floor(sorted.length * ratio));
  return sorted
    .slice(0, keep)
    .map((d) => {
      if (d.shape === "streak") {
        return `<ellipse cx="${d.x.toFixed(2)}" cy="${d.y.toFixed(2)}" rx="${(d.size * 1.6).toFixed(2)}" ry="${(d.size * 0.5).toFixed(2)}" fill="${d.color}" opacity="${d.opacity.toFixed(2)}" transform="rotate(${d.angle.toFixed(1)} ${d.x.toFixed(2)} ${d.y.toFixed(2)})"/>`;
      }
      return `<circle cx="${d.x.toFixed(2)}" cy="${d.y.toFixed(2)}" r="${d.size.toFixed(2)}" fill="${d.color}" opacity="${d.opacity.toFixed(2)}"/>`;
    })
    .join("");
}

// Knockout glyph for favicons. `markRef` is either a data: URI (for
// PNG-rasterisation runs) or a public path (for the vector favicon.svg
// that ships to the browser).
function knockoutSvg({ size, markRef, includeXmlns = true }) {
  const xmlns = includeXmlns ? ' xmlns="http://www.w3.org/2000/svg"' : "";
  const dots = size >= 24 ? dotsSvg(SPECKLE_KNOCKOUT, size) : "";
  const useShine = size >= 32;
  return `<svg${xmlns} width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <clipPath id="bowl-clip"><circle cx="50" cy="50" r="48"/></clipPath>
    <radialGradient id="bowl-shine" cx="32%" cy="26%" r="75%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.55"/>
      <stop offset="22%" stop-color="#FFFFFF" stop-opacity="0.18"/>
      <stop offset="55%" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.28"/>
    </radialGradient>
  </defs>
  <circle cx="50" cy="50" r="48" fill="${HENSELITE_GREEN}"/>
  <g clip-path="url(#bowl-clip)">${dots}</g>
  <circle cx="50" cy="50" r="28" fill="${BONE}"/>
  <circle cx="50" cy="50" r="28" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="0.4"/>
  <image href="${markRef}" x="28" y="28" width="44" height="44" preserveAspectRatio="xMidYMid meet"/>
  ${useShine ? '<circle cx="50" cy="50" r="48" fill="url(#bowl-shine)"/>' : ""}
  <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="0.6"/>
</svg>`;
}

// Halo & Rest glyph for PWA / apple-icon. `bleed` shrinks the bowl
// to a safe zone so platforms cropping into circles/rounded squares
// don't clip the mark. `bg` paints a rounded-square background;
// pass null for transparent.
function haloSvg({ size, markRef, bleed = false, bg = INK }) {
  const bowlR = bleed ? 36 : 48;
  const haloR = bleed ? 22 : 29;
  const markInsetR = bleed ? 19 : 25;
  const dots = size >= 22 ? dotsSvg(SPECKLE_HALO, size) : "";
  const useShine = size >= 32;
  const showRing = size >= 28;
  const bgRect = bg
    ? `<rect x="0" y="0" width="100" height="100" rx="22" fill="${bg}"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <clipPath id="bowl-clip"><circle cx="50" cy="50" r="${bowlR}"/></clipPath>
    <radialGradient id="bowl-shine" cx="32%" cy="26%" r="75%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.55"/>
      <stop offset="22%" stop-color="#FFFFFF" stop-opacity="0.18"/>
      <stop offset="55%" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.28"/>
    </radialGradient>
  </defs>
  ${bgRect}
  <circle cx="50" cy="50" r="${bowlR}" fill="${HENSELITE_GREEN}"/>
  <g clip-path="url(#bowl-clip)">${dots}</g>
  ${showRing ? `<circle cx="50" cy="50" r="${haloR}" fill="none" stroke="${BONE}" stroke-opacity="0.55" stroke-width="0.8"/>` : ""}
  <image href="${markRef}" x="${50 - markInsetR}" y="${50 - markInsetR}" width="${markInsetR * 2}" height="${markInsetR * 2}" preserveAspectRatio="xMidYMid meet"/>
  ${useShine ? `<circle cx="50" cy="50" r="${bowlR}" fill="url(#bowl-shine)"/>` : ""}
  <circle cx="50" cy="50" r="${bowlR}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="0.6"/>
</svg>`;
}

const markBlackDataUri = await loadMarkDataUri("mark-black.png");
const markBlackPublicHref = "/brand/henselite/mark-black.png";

await mkdir(PUBLIC_ICONS, { recursive: true });

// 1. Vector favicon — knockout, references the public mark path so the
//    SVG stays small. Browsers fetch the PNG separately.
{
  const svg = knockoutSvg({ size: 100, markRef: markBlackPublicHref });
  const out = resolve(PUBLIC, "favicon.svg");
  await writeFile(out, svg, "utf8");
  console.log("wrote", out);
}

// 2. Sized favicon PNGs — knockout, mark inlined as base64 so sharp
//    rasterises self-contained.
for (const size of [16, 32, 48, 64]) {
  const svg = knockoutSvg({ size, markRef: markBlackDataUri });
  const out = resolve(PUBLIC, `favicon-${size}.png`);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("wrote", out);
}

// 3. PWA icons — halo, full-bleed bowl on dark rounded-square.
for (const size of [192, 512]) {
  const svg = haloSvg({ size, markRef: markBlackDataUri });
  const out = resolve(PUBLIC_ICONS, `icon-${size}.png`);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("wrote", out);
}

// 4. Maskable PWA icons — bowl shrunk to safe zone so platforms can
//    crop without clipping the mark.
for (const size of [192, 512]) {
  const svg = haloSvg({ size, markRef: markBlackDataUri, bleed: true });
  const out = resolve(PUBLIC_ICONS, `maskable-${size}.png`);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("wrote", out);
}

// 5. Apple touch icon — halo at 180px. iOS rounds the corners itself
//    via the dark rounded-square bg.
{
  const svg = haloSvg({ size: 180, markRef: markBlackDataUri });
  const out = resolve(APP, "apple-icon.png");
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("wrote", out);
}
