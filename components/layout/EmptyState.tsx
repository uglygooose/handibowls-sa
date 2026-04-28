import type { ReactNode } from "react";

import { Bowl } from "@/components/brand/Bowl";
import { SplatterAccent } from "@/components/brand/SplatterAccent";
import type { ThemePreset } from "@/components/brand/theme-presets";
import { cn } from "@/lib/utils";

type Props = {
  title: ReactNode;
  description?: ReactNode;
  // Bowl preset shown in the centre. Defaults to atomic-red per the
  // design's clubs-empty-state, but callers can pick a different preset
  // to match the surface (e.g. midnight on the users empty state).
  bowlPreset?: ThemePreset;
  bowlSize?: number;
  // Splatter is in the bottom-right corner per design; uses the same
  // preset by default but can be overridden for tonal contrast.
  splatterPreset?: ThemePreset;
  splatterVariant?: 0 | 1 | 2;
  // Used to seed bowl/splatter SVG ids so two empty states on the same
  // page (rare) don't collide.
  idSuffix?: string;
  actions?: ReactNode;
  className?: string;
};

// Empty state per the Claude Design treatment:
//   - centred bowl with a splatter corner accent
//   - 36px italic Barlow Condensed title
//   - muted sub-copy
//   - optional actions row
export function EmptyState({
  title,
  description,
  bowlPreset = "atomic-red",
  bowlSize = 140,
  splatterPreset,
  splatterVariant = 1,
  idSuffix = "empty",
  actions,
  className,
}: Props) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "relative overflow-hidden rounded-[14px] border border-border bg-bone px-10 py-20 text-center",
        className,
      )}
    >
      <div className="mb-6 flex justify-center">
        <Bowl preset={bowlPreset} size={bowlSize} idSuffix={idSuffix} />
      </div>
      <h3 className="m-0 mb-2 font-display text-[36px] font-black italic uppercase tracking-[-0.02em] leading-tight">
        {title}
      </h3>
      {description && (
        <p className="m-0 mb-6 text-ink-muted">{description}</p>
      )}
      {actions && <div className="flex justify-center gap-2.5">{actions}</div>}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 -right-10 opacity-60"
      >
        <SplatterAccent
          preset={splatterPreset ?? bowlPreset}
          variant={splatterVariant}
          size={200}
          rotate={20}
        />
      </div>
    </div>
  );
}
