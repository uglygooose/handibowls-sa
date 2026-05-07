// Generates the canonical HandiBowls favicon + PWA icon set against
// the Phase 15 (final scope) Bowl glyph: plain Henselite-green
// speckled bowl, no Henselite mark overlay, no bone disc, no
// engraved ring. Operator decision (post PR #4 review): the mark
// overlay reads as pasted-on against the existing speckle visual
// treatment — drop it. The favicon trades brand-mark explicitness
// for an authentic green speckled bowl. Brand consistency over
// cleverness.
//
// Single template (`bowlSvg`) renders:
//   • bowl base circle (#08BB00, the Phase 13/13-9 Henselite default)
//   • speckle field clipped to the disc, ink + bone alternation
//   • radial-gradient shine on top at ≥32 px
//   • outer rim stroke for depth
//
// Output paths:
//   public/favicon.svg                    (vector source, transparent)
//   public/favicon-{16,32,48,64}.png      (raster fallbacks, transparent)
//   public/icons/icon-{192,512}.png       (PWA "any" purpose, dark bg)
//   public/icons/maskable-{192,512}.png   (bowl shrunk to safe zone)
//   app/apple-icon.png                    (180 px, dark bg)
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
const BONE = "#FAFAF7";

// Mulberry32 + hashSeed — match the runtime speckle algorithm in
// lib/brand/speckle.ts byte-for-byte. Duplicated here because the
// runtime is .ts and this script is .mjs; the algorithm is small
// and the icons are static.
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

// Single dataset matching `SPECKLE_DATASET_KNOCKOUT` in
// lib/brand/speckle.ts: 240 dots, no centre avoid, full-radius. Same
// `c2-handi` seed so the icon's speckle pattern matches the runtime
// component's at the corresponding render size.
function generateSpeckles({
  seed,
  count,
  radius,
  colors,
  sizeMin = 0.45,
  sizeMax = 2.3,
  cx = 50,
  cy = 50,
}) {
  const rand = mulberry32(seed);
  const dots = [];
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(rand()) * radius * 0.96;
    const theta = rand() * Math.PI * 2;
    const x = cx + Math.cos(theta) * r;
    const y = cy + Math.sin(theta) * r;
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

const SPECKLE_DATASET = generateSpeckles({
  seed: hashSeed("c2-handi"),
  count: 240,
  radius: 48,
  colors: [INK, BONE],
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

// Plain speckled bowl glyph. `bleed` shrinks the bowl to a safe
// zone so platforms cropping into circles/rounded squares don't
// clip the mark. `bg` paints a rounded-square background; pass
// null for transparent. Mirrors the runtime `Bowl` component's
// emblem threshold — engraved jack-target renders at sizes ≥ 64
// (favicon-16/32/48 stay plain; favicon-64 / PWA / apple all get
// the emblem).
//
// Emblem colour is INK (#0A0A0A) — the icons are pinned to
// HENSELITE_GREEN whose `on` swatch value is ink (Phase 13/13-9
// AA-contrast fix). Reads as black-on-green like the Bowl on
// ocean-green at runtime.
function bowlSvg({ size, bleed = false, bg = null, includeXmlns = true }) {
  const xmlns = includeXmlns ? ' xmlns="http://www.w3.org/2000/svg"' : "";
  const bowlR = bleed ? 36 : 48;
  const dots = size >= 16 ? dotsSvg(SPECKLE_DATASET, size) : "";
  const useShine = size >= 32;
  const useEmblem = size >= 64;
  const bgRect = bg
    ? `<rect x="0" y="0" width="100" height="100" rx="22" fill="${bg}"/>`
    : "";
  const emblem = useEmblem
    ? `<g clip-path="url(#bowl-clip)" opacity="0.85">
        <circle cx="50" cy="50" r="14" fill="none" stroke="${INK}" stroke-opacity="0.55" stroke-width="0.6"/>
        <circle cx="50" cy="50" r="9" fill="none" stroke="${INK}" stroke-opacity="0.35" stroke-width="0.5"/>
        <circle cx="50" cy="50" r="2.5" fill="${INK}" fill-opacity="0.75"/>
        <line x1="50" y1="36" x2="50" y2="41" stroke="${INK}" stroke-opacity="0.5" stroke-width="0.7" transform="rotate(0 50 50)"/>
        <line x1="50" y1="36" x2="50" y2="41" stroke="${INK}" stroke-opacity="0.5" stroke-width="0.7" transform="rotate(90 50 50)"/>
        <line x1="50" y1="36" x2="50" y2="41" stroke="${INK}" stroke-opacity="0.5" stroke-width="0.7" transform="rotate(180 50 50)"/>
        <line x1="50" y1="36" x2="50" y2="41" stroke="${INK}" stroke-opacity="0.5" stroke-width="0.7" transform="rotate(270 50 50)"/>
      </g>`
    : "";
  return `<svg${xmlns} width="${size}" height="${size}" viewBox="0 0 100 100">
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
  ${emblem}
  ${useShine ? `<circle cx="50" cy="50" r="${bowlR}" fill="url(#bowl-shine)"/>` : ""}
  <circle cx="50" cy="50" r="${bowlR}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="0.6"/>
</svg>`;
}

await mkdir(PUBLIC_ICONS, { recursive: true });

// 1. Vector favicon — transparent bg, full-bleed bowl.
{
  const svg = bowlSvg({ size: 100 });
  const out = resolve(PUBLIC, "favicon.svg");
  await writeFile(out, svg, "utf8");
  console.log("wrote", out);
}

// 2. Sized favicon PNGs — transparent bg.
for (const size of [16, 32, 48, 64]) {
  const svg = bowlSvg({ size });
  const out = resolve(PUBLIC, `favicon-${size}.png`);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("wrote", out);
}

// 3. PWA icons — full-bleed bowl on dark rounded-square.
for (const size of [192, 512]) {
  const svg = bowlSvg({ size, bg: INK });
  const out = resolve(PUBLIC_ICONS, `icon-${size}.png`);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("wrote", out);
}

// 4. Maskable PWA icons — bowl shrunk to safe zone so platforms can
//    crop without clipping.
for (const size of [192, 512]) {
  const svg = bowlSvg({ size, bg: INK, bleed: true });
  const out = resolve(PUBLIC_ICONS, `maskable-${size}.png`);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("wrote", out);
}

// 5. Apple touch icon — 180 px on dark rounded-square.
{
  const svg = bowlSvg({ size: 180, bg: INK });
  const out = resolve(APP, "apple-icon.png");
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("wrote", out);
}
