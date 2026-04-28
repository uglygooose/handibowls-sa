import type { ReactNode } from "react";

import { SpeckleLayer } from "@/components/brand/SpeckleLayer";
import { cn } from "@/lib/utils";

type Props = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  seed?: string | number;
  speckle?: boolean;
  className?: string;
};

// Page header per the Claude Design treatment:
//   - bone (white) background with a faint speckle layer (opacity 0.04)
//   - mono-uppercase eyebrow with a primary-500 dot prefix
//   - 56px italic uppercase Barlow Condensed title (font-display)
//   - max-width 1440px centred inner with flex-end alignment between
//     copy + actions
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  seed,
  speckle = true,
  className,
}: Props) {
  const speckleSeed =
    seed ??
    (typeof title === "string" ? `ph-${title}` : "ph-default");

  return (
    <header
      data-slot="page-header"
      className={cn(
        "relative overflow-hidden border-b border-border bg-bone px-10 pt-8 pb-7",
        className,
      )}
    >
      {speckle && (
        <SpeckleLayer
          seed={speckleSeed}
          density="med"
          opacity={0.04}
          className="z-0"
        />
      )}
      <div className="relative z-10 mx-auto flex max-w-[1440px] items-end justify-between gap-6">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className="mb-2 inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
              <span className="size-1.5 rounded-full bg-primary-500" aria-hidden="true" />
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-[56px] font-black italic leading-[0.95] tracking-[-0.02em] uppercase text-ink m-0">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-[15px] text-ink-muted m-0">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2.5">{actions}</div>
        )}
      </div>
    </header>
  );
}
