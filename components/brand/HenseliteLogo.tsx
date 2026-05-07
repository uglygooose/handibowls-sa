import Image from "next/image";

import { cn } from "@/lib/utils";

// Single source of truth for rendering the Henselite logo across every
// surface in the app. Phase 14 / surface-aware-henselite-logo. Replaces
// the previous trio of components/branding/{henselite-wordmark,henselite-
// mark,brand-lockup}.tsx — one component, one link target, one rule for
// variant selection. Consumers pass `variant` explicitly per surface;
// the component never inspects theme tokens or media queries.
//
// Two formats share a file so the verification grep
// (`HenseliteLogo` substring filter) covers both:
//   • <HenseliteLogo />     — full wordmark (icon + script + tagline)
//   • <HenseliteLogoMark /> — icon-only crop, for tight chrome
//
// Each renders an <a> linking to https://henselite.co.za/ with
// target="_blank" + rel="noopener noreferrer" + an accessible label.
//
// Variant selection — light surfaces use the colour PNG (green-and-white
// bowl + black "Henselite" script + "Choice of Champions" tagline);
// dark surfaces use the mono JPG (black silhouette) with `invert`
// applied via consumer className so the silhouette reads white. Mono
// variant is the same source asset as Phase 13/13-9 — clean black
// silhouette, no halo, suitable for filter inversion.

const HENSELITE_HREF = "https://henselite.co.za/";

const COLOUR_SRC = "/brand/henselite/henselite-logo.png";
const COLOUR_W = 373;
const COLOUR_H = 135;

const MONO_SRC = "/brand/henselite/Henselite-Logo-Black-1024x307.jpg";
const MONO_W = 1024;
const MONO_H = 307;

// Stacked colour source — used by the icon-only crop. Icon sits in
// the upper portion at roughly x∈[300,1170] y∈[80,880]; the offsets
// below isolate the ~870px square mark.
const STACKED_COLOUR_SRC = "/brand/henselite/collection-list-bowls-henselite.webp";
const STACKED_COLOUR_W = 1500;
const STACKED_COLOUR_H = 1500;
const STACKED_ICON_SQUARE = 870;
const STACKED_ICON_OFFSET_X = 300;
const STACKED_ICON_OFFSET_Y = 80;

type Variant = "colour" | "mono";

type WordmarkProps = {
  variant: Variant;
  /** Rendered height in px. Width auto-derives from source aspect ratio. */
  size?: number;
  className?: string;
};

export function HenseliteLogo({
  variant,
  size = 28,
  className,
}: WordmarkProps) {
  const isMono = variant === "mono";
  const src = isMono ? MONO_SRC : COLOUR_SRC;
  const srcW = isMono ? MONO_W : COLOUR_W;
  const srcH = isMono ? MONO_H : COLOUR_H;
  const renderedWidth = Math.round((size * srcW) / srcH);

  return (
    <a
      href={HENSELITE_HREF}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Henselite — opens henselite.co.za in a new tab"
      className={cn("inline-flex shrink-0 items-center", className)}
    >
      <Image
        src={src}
        alt="Henselite"
        width={srcW}
        height={srcH}
        priority={false}
        className="block shrink-0 select-none"
        style={{ width: renderedWidth, height: size }}
      />
    </a>
  );
}

type MarkProps = {
  variant: Variant;
  /** Rendered side length in px. Mark is square. */
  size?: number;
  /** When true, suppress the wrapping <a>. Use only when the mark sits
   *  inside another link (e.g. a club-admin sidebar Link to /). The
   *  consumer accepts responsibility for an externally-pointing anchor
   *  in that case. */
  noLink?: boolean;
  className?: string;
};

// Icon-only Henselite mark, square. Used in tight chrome — admin sidebar
// header (collapsed and expanded), and any place a wordmark won't fit.
// Mono variant crops the leftmost ~270×307 box from the horizontal lockup
// JPG. Colour variant samples the stacked WebP's icon area.
export function HenseliteLogoMark({
  variant,
  size = 24,
  noLink = false,
  className,
}: MarkProps) {
  const inner =
    variant === "mono" ? (
      <span
        aria-hidden={false}
        className={cn(
          "relative inline-block shrink-0 overflow-hidden align-middle",
          className,
        )}
        style={{ width: size, height: size }}
      >
        {(() => {
          const scale = size / MONO_H;
          const renderedWidth = MONO_W * scale;
          return (
            <Image
              src={MONO_SRC}
              alt="Henselite"
              width={MONO_W}
              height={MONO_H}
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
          );
        })()}
      </span>
    ) : (
      <span
        className={cn(
          "relative inline-block shrink-0 overflow-hidden align-middle",
          className,
        )}
        style={{ width: size, height: size }}
      >
        {(() => {
          const scale = size / STACKED_ICON_SQUARE;
          return (
            <Image
              src={STACKED_COLOUR_SRC}
              alt="Henselite"
              width={STACKED_COLOUR_W}
              height={STACKED_COLOUR_H}
              priority={false}
              style={{
                position: "absolute",
                top: -STACKED_ICON_OFFSET_Y * scale,
                left: -STACKED_ICON_OFFSET_X * scale,
                width: STACKED_COLOUR_W * scale,
                height: STACKED_COLOUR_H * scale,
                maxWidth: "none",
              }}
            />
          );
        })()}
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
