import { cn } from "@/lib/utils";

import {
  HANDIBOWLS_MARK_INNER,
  HANDIBOWLS_MARK_VIEWBOX,
} from "./handibowls-svgs";

type Props = {
  size?: number;
  className?: string;
};

// Icon-only HandiBowls bowl mark — same vector bowl that sits inside the
// lockup, isolated for sidebar collapsed states / app-icon contexts.
// Source SVG (Claude Design, 2026-05-07) is hard-coded atomic-red so the
// mark is theme-stable; consumers needing a themed colour should layer
// their own background instead of recolouring the SVG.
export function HandiBowlsMark({ size = 40, className }: Props) {
  return (
    <svg
      aria-label="HandiBowls"
      role="img"
      viewBox={HANDIBOWLS_MARK_VIEWBOX}
      width={size}
      height={size}
      className={cn("block shrink-0 select-none", className)}
      dangerouslySetInnerHTML={{ __html: HANDIBOWLS_MARK_INNER }}
    />
  );
}
