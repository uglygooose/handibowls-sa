import type { ReactNode } from "react";

import { Bowl } from "@/components/brand/Bowl";
import { SpeckleLayer } from "@/components/brand/SpeckleLayer";
import { SplatterAccent } from "@/components/brand/SplatterAccent";
import type { ThemePreset } from "@/components/brand/ThemeApplier";
import { cn } from "@/lib/utils";

type Props = {
  bowlPreset: ThemePreset;
  splatterPreset?: ThemePreset;
  splatterVariant?: 0 | 1 | 2;
  side?: "left" | "right";
  children?: ReactNode;
};

// Split-panel side with a huge dimensional bowl peeking from the edge,
// a splatter accent, speckle overlay, and an optional quote/stat card.
// Hidden on mobile — each auth page collapses to its main panel only.
export function AuthAside({
  bowlPreset,
  splatterPreset,
  splatterVariant = 0,
  side = "left",
  children,
}: Props) {
  const right = side === "right";
  return (
    <aside
      className={cn(
        "relative hidden overflow-hidden border-border bg-surface-muted md:block",
        right ? "order-2 border-l" : "border-r",
      )}
    >
      <SpeckleLayer seed={`auth-aside-${bowlPreset}`} density="med" opacity={0.08} />

      {/* The bowl peeks in from the aside's outer edge.
          Phase 13 / 13-1 / commit 10: wrapped in aria-hidden="true" so
          SR users don't hear "Atomic Red bowl" / "Ocean Blue bowl"
          announcements — this Bowl is purely decorative chrome on the
          auth split-panel, NOT informative content. The Bowl primitive
          ships its own role="img" + aria-label by default (correct for
          non-decorative consumers); aria-hidden on the wrapper is the
          per-instance opt-out. */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute top-1/2 -translate-y-1/2",
          right ? "-right-[240px]" : "-left-[240px]",
        )}
        style={{ filter: "drop-shadow(0 40px 60px rgba(0,0,0,0.25))" }}
      >
        <Bowl themeId={bowlPreset} size={720} />
      </div>

      {splatterPreset && (
        <div
          className={cn(
            "pointer-events-none absolute bottom-[60px] opacity-90",
            right ? "left-[60px]" : "right-[60px]",
          )}
        >
          <SplatterAccent preset={splatterPreset} variant={splatterVariant} size={220} rotate={-10} />
        </div>
      )}

      {children && (
        <div
          className={cn(
            "absolute bottom-12 z-[3] max-w-[380px] rounded-[20px] border-2 border-ink bg-surface/92 p-6 backdrop-blur-sm",
            right ? "right-12" : "left-12",
          )}
          style={{ boxShadow: "8px 8px 0 var(--color-ink)" }}
        >
          {children}
        </div>
      )}
    </aside>
  );
}
