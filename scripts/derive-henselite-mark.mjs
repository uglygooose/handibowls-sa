// Derive square Henselite-mark PNGs (black + white) from the existing
// horizontal lockup JPG. One-off script for Phase 15 — the brand pack
// ships only horizontal/stacked colour lockups, no clean square mark
// crop with transparent background. We sample the icon area from the
// official mono JPG, square-crop centred on the icon, and chroma-key
// the white background to alpha. Edge artefacts are inherent to chroma
// keying a JPEG source — visual verification at 16-32px is part of the
// commit; if too rough at small sizes, log a drift entry for future
// SVG vector sourcing direct from Henselite.
//
// Output:
//   public/brand/henselite/mark-black.png  — black icon on transparent
//   public/brand/henselite/mark-white.png  — white icon on transparent
//
// Run via `node scripts/derive-henselite-mark.mjs`.

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const SOURCE = resolve(
  REPO,
  "public/brand/henselite/Henselite-Logo-Black-1024x307.jpg",
);
const OUT_BLACK = resolve(REPO, "public/brand/henselite/mark-black.png");
const OUT_WHITE = resolve(REPO, "public/brand/henselite/mark-white.png");

// Source JPG is 1024×307. The icon (bowl-shape silhouette) occupies the
// leftmost ~270 px horizontally; the script wordmark "Henselite" begins
// roughly at x=290. A naive 307×307 crop from x=0 picks up a sliver of
// the "H" letter on the right edge — visible at small renders as a
// stray dark notch. Tighten the crop to the icon's own bounds, then
// pad horizontally to a square canvas so the icon reads as centred on
// every consumer surface.
const ICON_RAW = { left: 0, top: 0, width: 270, height: 307 };
const SQUARE_SIZE = 307;
const PAD_LEFT = Math.round((SQUARE_SIZE - ICON_RAW.width) / 2);
const PAD_RIGHT = SQUARE_SIZE - ICON_RAW.width - PAD_LEFT;

// Luminosity thresholds for the chroma-key. Below `darkCutoff` →
// solid icon pixel. Above `lightCutoff` → fully transparent
// background. In between → anti-aliased edge, alpha proportional to
// darkness.
const DARK_CUTOFF = 60;
const LIGHT_CUTOFF = 240;

async function chromaKey(
  rgbaBuf,
  width,
  height,
  iconRgb /* [r,g,b] for the output icon colour */,
) {
  const out = Buffer.from(rgbaBuf);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const lum = (r + g + b) / 3;
    if (lum >= LIGHT_CUTOFF) {
      // Background → fully transparent
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
    } else if (lum <= DARK_CUTOFF) {
      // Solid icon pixel → output colour at full alpha
      out[i] = iconRgb[0];
      out[i + 1] = iconRgb[1];
      out[i + 2] = iconRgb[2];
      out[i + 3] = 255;
    } else {
      // Anti-aliased edge — alpha proportional to (1 - lum/255)
      const alpha = Math.round(
        255 *
          (1 -
            (lum - DARK_CUTOFF) / (LIGHT_CUTOFF - DARK_CUTOFF)),
      );
      out[i] = iconRgb[0];
      out[i + 1] = iconRgb[1];
      out[i + 2] = iconRgb[2];
      out[i + 3] = alpha;
    }
  }
  return out;
}

async function deriveMark(outputPath, iconRgb, label) {
  const input = await readFile(SOURCE);
  // 1. Tight extract on the icon area (no script-wordmark bleed).
  // 2. Pad horizontally with white so the icon is centred in a square.
  //    Padding white survives chroma-keying as transparent — same outcome
  //    as transparent padding, just simpler in raw-pixel terms.
  // 3. Chroma-key to alpha + recolour the icon to iconRgb.
  const padded = await sharp(input)
    .extract(ICON_RAW)
    .extend({
      left: PAD_LEFT,
      right: PAD_RIGHT,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const keyed = await chromaKey(
    padded.data,
    padded.info.width,
    padded.info.height,
    iconRgb,
  );
  await sharp(keyed, {
    raw: {
      width: padded.info.width,
      height: padded.info.height,
      channels: 4,
    },
  })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
  console.log(
    `wrote ${outputPath} (${label}) — ${padded.info.width}×${padded.info.height}`,
  );
}

await deriveMark(OUT_BLACK, [0, 0, 0], "black on transparent");
await deriveMark(OUT_WHITE, [255, 255, 255], "white on transparent");
