import type { ReactNode } from "react";

import { SpeckleField, type SpeckleIntensity } from "@/components/brand/SpeckleField";
import { SplatterAccent } from "@/components/brand/SplatterAccent";
import type { ThemePreset } from "@/components/brand/ThemeApplier";
import { SPLATTER_SIZE, type SplatterSize } from "@/lib/brand/presets";
import { cn } from "@/lib/utils";

// Phase 12.5 / 12.5-6.5 — shared player identity-hero primitive.
//
// Three player surfaces ship a themed-colored hero in the design
// source bundle, all with identical chrome:
//
//   .t20-hero       (player-styles-additions.css:199)
//   .profile-hero   (player-styles.css:711)
//   .detail-hero    (player-styles.css:418)
//
//   {
//     position: relative;
//     overflow: hidden;
//     border-radius: 20px;
//     padding: 18px;
//     background: var(--primary-500);
//     color: var(--on-primary);  // (.detail-hero / .profile-hero)
//     margin-bottom: 14-16px;
//   }
//
// Variation between the three is purely INNER content (avatar block
// vs grade-pill ladder vs title+meta+CTA). Chrome is shared. The
// shipped /me + /tournaments/[id] surfaces drifted to a full-bleed
// banner pattern (no border-radius, breaks out of the centered
// .mcontent wrapper) — closing the audit's `player-hero-shape-drift`
// finding requires landing all three on this primitive.
//
// Pattern P-N (no hero) surfaces — /play, /book, /tournaments,
// /me/inbox — do NOT consume PlayerHero. The bundle prescribes no
// hero on those (.mcontent + section-heads only). PlayerHero is
// strictly for identity-tier surfaces.
//
// Bundle SpeckleField values per surface:
//   /t20:               density 1.3 opacityScale 1.4  → "bold"
//   /tournaments/[id]:  density 1.3 opacityScale 1.4  → "bold"
//   /me:                density 1.1 opacityScale 1.2  → ≈ "medium"
//
// Intensity defaults to "bold" — matches 2 of 3 consumers; /me opts
// to "medium" via the prop. Consumers also choose splatter spec
// per-surface (e.g. /me's splatter at right:-50 bottom:-60 vs
// /t20's at right:-22 bottom:-22).

const TITLE_SIZE_PX: Record<"grade" | "identity" | "detail", number> = {
  /** /t20 grade reveal — `.t20-grade { font-size: 56px; ... }`. */
  grade: 56,
  /** /me name — `.profile-hero .name { font-size: 28px; ... }`. */
  identity: 28,
  /** /tournaments/[id] heading — `.detail-hero h1 { font-size: 28px; ... }`. */
  detail: 28,
};

type SpeckleSpec =
  | false
  | {
      preset?: ThemePreset;
      seedKey: string;
      intensity?: SpeckleIntensity;
      /** Bundle uses 20 on /t20 + /tournaments/[id], 0 on /me — both
       *  look the same visually because the parent has overflow:hidden,
       *  but the prop matches the bundle's own JSX exactly. Default 20. */
      borderRadius?: number;
    };

type SplatterSpec =
  | false
  | {
      preset?: ThemePreset;
      variant?: 0 | 1 | 2;
      size?: SplatterSize | number;
      rotate?: number;
      opacity?: number;
      top?: number | null;
      right?: number | null;
      bottom?: number;
      left?: number;
    };

type Props = {
  /** Required — the surface's primary headline (h1 reading order). */
  title: ReactNode;
  /** Title size tier. "grade" 56px / "identity" 28px / "detail" 28px.
   *  Pass a number for an exact size when neither tier fits. Default
   *  "identity". */
  titleSize?: "grade" | "identity" | "detail" | number;
  /** Optional decoration / avatar slot rendered as a flex sibling
   *  on the LEFT of the title-meta-actions column. Used by /me for
   *  the bundle's `.profile-hero .avatar` 84px ringed circle that
   *  sits beside the name+badges block. When omitted, the title
   *  column fills the hero. */
  leading?: ReactNode;
  /** Optional small-caps eyebrow above the title. White-tinted by
   *  default (text inherits text-on-primary). Caller supplies
   *  styling via the eyebrow prop's children. */
  eyebrow?: ReactNode;
  /** Optional pill / badge / metadata row below the title. */
  meta?: ReactNode;
  /** Optional CTA below meta — full-width primary or smaller chip-
   *  style buttons depending on consumer. */
  actions?: ReactNode;
  /** Optional inline content slot AFTER actions but inside the hero.
   *  Used by /me for the avatar+name layout (rendered before all
   *  the slots; pass via a JSX render-prop pattern by composing as
   *  the title slot or via children). */
  children?: ReactNode;
  /** SpeckleField overlay. Default `{ intensity: "bold",
   *  borderRadius: 20, seedKey: derived-from-title }`. */
  speckle?: SpeckleSpec;
  /** Corner SplatterAccent. No default — consumers opt-in per
   *  bundle's per-surface positioning (different right/bottom
   *  insets per .profile-hero / .t20-hero / .detail-hero). */
  splatter?: SplatterSpec;
  /** Reset the on-primary colour token if the consumer needs a
   *  different ink (rare). */
  className?: string;
};

function resolveTitleSize(size: Props["titleSize"]): number {
  if (typeof size === "number") return size;
  return TITLE_SIZE_PX[size ?? "identity"];
}

function renderSplatter(spec: SplatterSpec): ReactNode {
  if (spec === false || spec === undefined) return null;
  const {
    preset = "atomic-red",
    variant = 1,
    size,
    rotate = 0,
    opacity = 0.5,
    top,
    right,
    bottom,
    left,
  } = spec;
  const inset = {
    ...(top !== undefined && top !== null ? { top } : {}),
    ...(right !== undefined && right !== null ? { right } : {}),
    ...(bottom !== undefined ? { bottom } : {}),
    ...(left !== undefined ? { left } : {}),
  };
  const resolvedSize = typeof size === "number" ? size : SPLATTER_SIZE[size ?? "S"];
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-[1]"
      style={{ ...inset, opacity }}
    >
      <SplatterAccent
        preset={preset}
        variant={variant}
        size={resolvedSize}
        rotate={rotate}
      />
    </div>
  );
}

export function PlayerHero({
  title,
  titleSize,
  leading,
  eyebrow,
  meta,
  actions,
  children,
  speckle,
  splatter,
  className,
}: Props) {
  const speckleSpec: SpeckleSpec =
    speckle === false
      ? false
      : {
          preset: speckle?.preset ?? "atomic-red",
          seedKey: speckle?.seedKey ?? `player-hero-${typeof title === "string" ? title : "untitled"}`,
          intensity: speckle?.intensity ?? "bold",
          borderRadius: speckle?.borderRadius ?? 20,
        };

  return (
    <section
      data-slot="player-hero"
      className={cn(
        // .profile-hero / .t20-hero / .detail-hero — radius 20 + bg
        // primary + padding 18 (= p-[18px]) + isolate stacking +
        // overflow-hidden so SplatterAccent's intrinsic rotate
        // doesn't leak.
        "relative isolate overflow-hidden rounded-[20px] bg-primary-500 p-[18px] text-[color:var(--color-on-primary)]",
        className,
      )}
    >
      {speckleSpec !== false && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
        >
          <SpeckleField
            preset={speckleSpec.preset ?? "atomic-red"}
            seedKey={speckleSpec.seedKey}
            intensity={speckleSpec.intensity ?? "bold"}
            borderRadius={speckleSpec.borderRadius ?? 20}
          />
        </div>
      )}
      {renderSplatter(splatter ?? false)}

      <div
        data-slot="player-hero-inner"
        className={cn(
          "relative z-10",
          leading && "flex items-start gap-4",
        )}
      >
        {leading && (
          <div data-slot="player-hero-leading" className="shrink-0">
            {leading}
          </div>
        )}
        <div data-slot="player-hero-content" className="min-w-0 flex-1">
          {eyebrow && (
            <div
              data-slot="player-hero-eyebrow"
              className="font-mono text-[11px] font-bold uppercase tracking-[0.1em]"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              {eyebrow}
            </div>
          )}
          <h1
            data-slot="player-hero-title"
            className="truncate font-display font-black italic uppercase leading-[0.95] tracking-tight"
            style={{ fontSize: `${resolveTitleSize(titleSize)}px` }}
          >
            {title}
          </h1>
          {meta && (
            <div data-slot="player-hero-meta" className="mt-2.5">
              {meta}
            </div>
          )}
          {actions && (
            <div data-slot="player-hero-actions" className="mt-3.5">
              {actions}
            </div>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}
