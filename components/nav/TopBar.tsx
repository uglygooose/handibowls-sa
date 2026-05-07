import type { ReactNode } from "react";

import { Bowl } from "@/components/brand/Bowl";
import { HenseliteLogo } from "@/components/brand/HenseliteLogo";
import type { ThemePreset } from "@/components/brand/ThemeApplier";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { cn } from "@/lib/utils";

type Props = {
  title?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  variant?: "light" | "dark";
  /** Active theme preset for the brand chrome's Bowl glyph. Required when
   *  rendering the brand chrome (no `title`). Player layout passes the
   *  player's primary club preset; club_admin layout passes the host
   *  club's preset; the platform default falls through to ocean-green
   *  (Henselite default). Ignored when `title` is provided. */
  themePreset?: ThemePreset;
  className?: string;
};

export function TopBar({
  title,
  left,
  right,
  variant = "light",
  themePreset = "ocean-green",
  className,
}: Props) {
  const isDark = variant === "dark";
  return (
    <header
      data-slot="top-bar"
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4",
        isDark
          ? "border-sidebar-border bg-surface-inverse text-ink-inverse"
          : "border-border bg-surface text-ink",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {left}
        {title ? (
          <h1 className="truncate font-display text-lg font-bold tracking-tight">
            {title}
          </h1>
        ) : (
          // Phase 14 / surface-aware-henselite-logo + player shell lockup
          // compaction: Henselite logo (colour on light, mono+invert on
          // dark) — links externally — paired with the HandiBowls bowl
          // glyph (no wordmark text). Glyph picks up the active theme's
          // primary colour via `themePreset`.
          <span className="inline-flex items-center gap-2.5">
            <HenseliteLogo
              variant={isDark ? "mono" : "colour"}
              size={24}
              className={cn(isDark && "invert")}
            />
            <span
              aria-hidden="true"
              className={cn(
                "h-6 w-px shrink-0 self-stretch border-l",
                isDark ? "border-ink-inverse/20" : "border-foreground/20",
              )}
            />
            <Bowl themeId={themePreset} size={28} />
          </span>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {right}
        <SignOutButton variant={variant} />
      </div>
    </header>
  );
}
