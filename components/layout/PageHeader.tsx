import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { SpeckleLayer } from "@/components/brand/SpeckleLayer";

type Props = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  seed?: string | number;
  speckle?: boolean;
  className?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  seed = "page-header",
  speckle = true,
  className,
}: Props) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "relative overflow-hidden border-b border-border bg-surface-muted",
        className,
      )}
    >
      {speckle && (
        <SpeckleLayer seed={seed} density="med" opacity={0.06} />
      )}
      <div className="relative z-10 flex flex-col gap-3 px-6 py-8 md:flex-row md:items-end md:justify-between md:gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          {eyebrow && (
            <span className="font-display text-xs tracking-widest uppercase text-ink-muted">
              {eyebrow}
            </span>
          )}
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-sm text-ink-muted">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}
