import { ImageResponse } from "next/og";

// Conventional OG image at 1200×630 — Next.js auto-attaches this to
// `metadata.openGraph.images` for every route that doesn't override.
// Locked at Phase 13 / 13-4 / Batch E (D6.3 / D6.4): bone background +
// 24px atomic-red accent strip top + bowl mark left + wordmark + tagline.

export const alt =
  "HandiBowls — Tournaments, scores, and skills in your pocket";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ATOMIC_RED = "#D7261E";
const INK = "#0A0A0A";
const BONE = "#FAFAF7";
const ON_PRIMARY = "#FFFFFF";

export default async function Image() {
  // Bowl mark — same simple-variant geometry as public/favicon.svg, scaled
  // up. Inline SVG so Satori (the renderer behind ImageResponse) handles
  // it without external font/image dependencies.
  const bowlMark = (
    <svg
      width="380"
      height="380"
      viewBox="0 0 100 100"
      style={{ display: "block" }}
    >
      <circle cx="50" cy="50" r="42" fill={ATOMIC_RED} />
      <circle
        cx="50"
        cy="50"
        r="26"
        fill="none"
        stroke={ON_PRIMARY}
        strokeOpacity="0.595"
        strokeWidth="2.2"
      />
      <circle
        cx="50"
        cy="50"
        r="14"
        fill="none"
        stroke={ON_PRIMARY}
        strokeOpacity="0.4675"
        strokeWidth="1.8"
      />
      <circle
        cx="50"
        cy="50"
        r="4.5"
        fill={ON_PRIMARY}
        fillOpacity="0.85"
      />
      <ellipse
        cx="36"
        cy="32"
        rx="14"
        ry="9"
        fill={ON_PRIMARY}
        fillOpacity="0.18"
      />
    </svg>
  );

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
        {/* Atomic-red top accent strip */}
        <div
          style={{
            width: "100%",
            height: 24,
            background: ATOMIC_RED,
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
          {bowlMark}

          {/* Wordmark + tagline column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 28,
              maxWidth: 620,
            }}
          >
            {/* HandiBowls wordmark — HANDI in ink, BOWLS in atomic-red. */}
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
              <span style={{ color: ATOMIC_RED }}>Bowls</span>
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
