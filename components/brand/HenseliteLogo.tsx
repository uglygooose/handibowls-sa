import Image from "next/image";

import { cn } from "@/lib/utils";

// Single source of truth for rendering the Henselite logo across every
// surface in the app.
//
// SA BRAND STANDARD (per Henselite SA, Phase 15 fix): the Henselite
// wordmark renders BLACK ONLY. The green-icon colour variant
// (henselite-logo.png) is the UK lockup and is NOT permitted in the
// app. The PNG file remains in `public/brand/henselite/` for reference
// but no component sources from it. The black horizontal lockup
// (`Henselite-Logo-Black-1024x307.jpg`) is the sole render asset.
//
// On dark surfaces (admin sidebar / super-admin chrome / dark footer)
// consumers apply `className="invert"` to flip the black mark to a
// white silhouette via CSS filter — same pattern the previous mono
// variant used. The component itself stays unaware of surface tone.
//
// Two named exports:
//   • <HenseliteLogo />     — full horizontal wordmark (icon + script)
//   • <HenseliteLogoMark /> — icon-only crop, for tight chrome
//
// Both wrap an <a> linking to https://henselite.co.za/ with
// target="_blank" + rel="noopener noreferrer" + an accessible label.

const HENSELITE_HREF = "https://henselite.co.za/";

// Sole render asset — the SA-correct black horizontal lockup.
const SRC = "/brand/henselite/Henselite-Logo-Black-1024x307.jpg";
const SRC_W = 1024;
const SRC_H = 307;

type WordmarkProps = {
  /** Rendered height in px. Width auto-derives from source aspect ratio. */
  size?: number;
  className?: string;
};

export function HenseliteLogo({ size = 28, className }: WordmarkProps) {
  const renderedWidth = Math.round((size * SRC_W) / SRC_H);
  return (
    <a
      href={HENSELITE_HREF}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Henselite — opens henselite.co.za in a new tab"
      className={cn("inline-flex shrink-0 items-center", className)}
    >
      <Image
        src={SRC}
        alt="Henselite"
        width={SRC_W}
        height={SRC_H}
        priority={false}
        className="block shrink-0 select-none"
        style={{ width: renderedWidth, height: size }}
      />
    </a>
  );
}

type MarkProps = {
  /** Rendered side length in px. Mark is square. */
  size?: number;
  /** When true, suppress the wrapping <a>. Use only when the mark sits
   *  inside another link (e.g. a club-admin sidebar Link to /). The
   *  consumer accepts responsibility for an externally-pointing anchor
   *  in that case. */
  noLink?: boolean;
  className?: string;
};

// Icon-only Henselite mark, square. Used in tight chrome — admin
// sidebar header (collapsed and expanded). Crops the leftmost ~270×307
// box from the horizontal lockup JPG, scaled to render the icon
// area square at `size × size`.
export function HenseliteLogoMark({
  size = 24,
  noLink = false,
  className,
}: MarkProps) {
  const scale = size / SRC_H;
  const renderedWidth = SRC_W * scale;

  const inner = (
    <span
      className={cn(
        "relative inline-block shrink-0 overflow-hidden align-middle",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src={SRC}
        alt="Henselite"
        width={SRC_W}
        height={SRC_H}
        priority={false}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: renderedWidth,
          height: size,
          maxWidth: "none",
        }}
      />
    </span>
  );

  if (noLink) {
    return inner;
  }

  return (
    <a
      href={HENSELITE_HREF}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Henselite — opens henselite.co.za in a new tab"
      className="inline-flex shrink-0 items-center"
    >
      {inner}
    </a>
  );
}
