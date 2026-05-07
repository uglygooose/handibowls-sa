import Link from "next/link";

import { HandiBowlsWordmark } from "@/components/brand/HandiBowlsWordmark";
import { cn } from "@/lib/utils";

import { HenseliteWordmark } from "./henselite-wordmark";

type Size = "sm" | "md" | "lg";

type Props = {
  variant?: "colour" | "mono";
  size?: Size;
  /** Defaults to "/" — the lockup always reads as a home link. */
  href?: string;
  className?: string;
};

// Heights tuned so HandiBowls (square-shouldered display caps) reads as
// visually balanced next to Henselite (script). Henselite hangs slightly
// taller because its descenders/ascenders take more vertical room than
// HandiBowls' uppercase-only mark.
const SIZE_MAP: Record<
  Size,
  { henselite: number; handibowls: number; gap: string }
> = {
  sm: { henselite: 22, handibowls: 18, gap: "gap-2.5" },
  md: { henselite: 28, handibowls: 24, gap: "gap-3" },
  lg: { henselite: 32, handibowls: 26, gap: "gap-3.5" },
};

export function BrandLockup({
  variant = "colour",
  size = "md",
  href = "/",
  className,
}: Props) {
  const dims = SIZE_MAP[size];

  return (
    <Link
      href={href}
      aria-label="Henselite × HandiBowls"
      className={cn(
        "inline-flex items-center text-ink no-underline",
        dims.gap,
        className,
      )}
    >
      <HenseliteWordmark variant={variant} size={dims.henselite} />
      <span
        aria-hidden="true"
        className="border-foreground/20 h-[1em] w-px self-stretch border-l"
        style={{ height: dims.henselite }}
      />
      <HandiBowlsWordmark variant="light" height={dims.handibowls} />
    </Link>
  );
}
