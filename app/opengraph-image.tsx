import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

// Conventional OG image at 1200×630 — Next.js auto-attaches this to
// `metadata.openGraph.images` for every route that doesn't override.
// Bone background + 24px Henselite-green accent strip top + bowl mark
// left + wordmark + tagline. Phase 13 / 13-9: switched from atomic-red
// to the Henselite partnership default.

export const alt =
  "HandiBowls — Tournaments, scores, and skills in your pocket";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const HENSELITE_GREEN = "#08BB00";
const INK = "#0A0A0A";
const BONE = "#FAFAF7";

export default async function Image() {
  // Bowl mark — the Claude Design icon-only SVG (Henselite-green speckled
  // bowl with radial-shine gradient). We read the file at build time and embed
  // it as a data:image/svg+xml URI on an <img>. Satori (the engine behind
  // ImageResponse) renders SVG natively, so vector paths + gradients
  // arrive crisp at any output size.
  // Reference: docs/01-app/03-api-reference/03-file-conventions/
  // 01-metadata/opengraph-image.mdx — "Fetch local image as base64".
  const markSvg = await readFile(
    join(process.cwd(), "public", "brand", "handibowls", "handibowls-mark.svg"),
    "utf8",
  );
  const markSrc = `data:image/svg+xml;base64,${Buffer.from(markSvg).toString(
    "base64",
  )}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BONE,
        }}
      >
        {/* Henselite-green top accent strip */}
        <div
          style={{
            width: "100%",
            height: 24,
            background: HENSELITE_GREEN,
          }}
        />

        {/* Main content area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 64,
            padding: "0 80px",
          }}
        >
          <img
            src={markSrc}
            alt=""
            style={{ width: 380, height: 380, display: "block" }}
          />

          {/* Wordmark + tagline column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 28,
              maxWidth: 620,
            }}
          >
            {/* HandiBowls wordmark — HANDI in ink, BOWLS in Henselite green. */}
            <div
              style={{
                display: "flex",
                fontSize: 124,
                fontWeight: 900,
                fontStyle: "italic",
                lineHeight: 0.95,
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
              }}
            >
              <span style={{ color: INK }}>Handi</span>
              <span style={{ color: HENSELITE_GREEN }}>Bowls</span>
            </div>

            {/* Tagline */}
            <div
              style={{
                fontSize: 32,
                color: INK,
                lineHeight: 1.3,
                maxWidth: 580,
              }}
            >
              Tournaments, scores, and skills in your pocket — for South
              African bowls.
            </div>

            {/* Footer URL */}
            <div
              style={{
                fontSize: 18,
                color: "#717171",
                marginTop: 16,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              app.handibowls.co.za
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
