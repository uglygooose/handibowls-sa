import { cn } from "@/lib/utils";

import {
  HANDIBOWLS_LOCKUP_DARK_INNER,
  HANDIBOWLS_LOCKUP_LIGHT_INNER,
  HANDIBOWLS_LOCKUP_VIEWBOX,
} from "./handibowls-svgs";

type Props = {
  variant?: "light" | "dark";
  className?: string;
  height?: number;
};

// Renders the unified HandiBowls lockup designed by Claude Design
// (HANDI text + bowl + BOWLS text, baked into a single SVG so positioning
// is fixed and consistent at every render size). The two variants flip
// only the HANDI ink colour (dark vs light); BOWLS and the bowl stay
// hard-coded Henselite green (#08BB00, Phase 13/13-9 partnership default)
// per design spec.
//
// We embed via dangerouslySetInnerHTML rather than next/image because the
// SVG uses <text font-family="Barlow Condensed">, which only resolves
// when the SVG lives in the host document. <img src=".svg"> would
// sandbox font resolution and the wordmark would fall back to a generic
// sans-serif.
const VIEWBOX_W = 800;
const VIEWBOX_H = 170;

export function HandiBowlsWordmark({
  variant = "light",
  className,
  height = 40,
}: Props) {
  const width = Math.round((height * VIEWBOX_W) / VIEWBOX_H);
  const inner =
    variant === "light"
      ? HANDIBOWLS_LOCKUP_LIGHT_INNER
      : HANDIBOWLS_LOCKUP_DARK_INNER;

  return (
    <svg
      aria-label="HandiBowls"
      role="img"
      viewBox={HANDIBOWLS_LOCKUP_VIEWBOX}
      width={width}
      height={height}
      className={cn("block shrink-0 select-none", className)}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
