import type { ReactNode } from "react";

import { SpeckleLayer, type SpeckleDensity } from "@/components/brand/SpeckleLayer";
import { SplatterAccent } from "@/components/brand/SplatterAccent";
import type { ThemePreset } from "@/components/brand/ThemeApplier";
import { SPLATTER_SIZE, type SplatterSize } from "@/lib/brand/presets";
import { cn } from "@/lib/utils";

// Phase 12.5 / 12.5-6 — shared admin + super-admin page hero primitive.
//
// All values lifted from the design source bundle's `.page-hero` /
// `.page-hero-inner` / `.page-hero h1` / `.page-hero .sub` rules in
// `admin-styles.css` (lines 313-323). Adopting the bundle wholesale
// closes the audit's `admin-page-hero-primitive-missing` drift +
// the `super-admin-vs-club-admin-page-header-divergence` divergence
// — both club-admin and super-admin surfaces consume this single
// primitive; super-admin's old `<PageHeader>` is retired in a
// separate commit.
//
// Conflicts with the 12.5-6 prompt are surfaced in the Stage A
// report (commit message); per the prompt's own rule "if the
// design source bundle conflicts with anything in the prompt, the
// bundle wins." Notable design-source-wins choices:
//
//   • border-radius 18px (NOT 20px or 14px)
//   • bg-bone (white #ffffff, NOT bg-surface)
//   • h1 56px font-display font-black, NOT italic (drift in
//     shipped surfaces — they all set italic; design has none on
//     h1, only on subtitle)
//   • subtitle 22px Barlow Condensed font-bold ITALIC ink-muted
//     (matches t20-page-list.jsx:67 design markup)
//   • eyebrow Barlow Condensed (font-display) font-bold 11px,
//     NOT JetBrains Mono / 10px (the shipped Pattern B's mono
//     eyebrow is drift)
//   • inner padding 32px 36px = px-9 py-8 (NOT px-8 py-7)
//   • min-height 156px (NOT 128px)
//   • items-end (NOT items-start)
//   • Speckle: SpeckleLayer with density+opacity (admin primitive
//     per design); SpeckleField is a player-side primitive only.
//   • Splatter sizes via the `SPLATTER_SIZE` tier (S=130 / M=180
//     / L=300) — design source admin heroes use 300.
//
// containerWidth is a HandiBowls-specific extension. Design source
// uses a single max-w-[1480px] tier on `.page`; the shipped
// HandiBowls codebase split this into list (max-w-7xl = 1280px)
// vs form (max-w-[1100px]) and the user-locked decision keeps that
// distinction. `none` skips the wrapper for callers that own their
// own container (like list pages with sub-grid layouts).

type SpeckleSpec =
  | false
  | { density?: SpeckleDensity; opacity?: number; seed?: string };

type SplatterSpec =
  | false
  | {
      preset?: ThemePreset;
      variant?: 0 | 1 | 2;
      /** Size tier ("S" | "M" | "L") OR an exact pixel value when an
       *  edge-case requires it (e.g. the secondary in-hero accent on
       *  /manage/t20). Default tier is "L". */
      size?: SplatterSize | number;
      rotate?: number;
      opacity?: number;
      /** Top inset in px (negative pulls the splatter above the hero
       *  card border). Default -40 — pass `null` to omit (e.g. when
       *  pinning to bottom instead). */
      top?: number | null;
      /** Right inset in px. Default -30 — pass `null` to omit when
       *  pinning to left. */
      right?: number | null;
      /** Bottom inset in px (negative pulls below border). Omitted by
       *  default. The /manage/t20 secondary splatter uses
       *  `{ bottom: -40, left: 128 }` per the design source. */
      bottom?: number;
      /** Left inset in px. Omitted by default. */
      left?: number;
    };

type Props = {
  /** Required — the surface's primary headline (h1 reading order). */
  title: ReactNode;
  /** Optional small-caps mono-feel label above the title. Design
   *  source uses Barlow Condensed font-bold 11px tracking 0.16em
   *  ink-muted (`.eyebrow` class). */
  eyebrow?: ReactNode;
  /** Optional italic-Barlow 22px sub-headline below the title. Used
   *  on /manage/t20 ("skills assessment") + /manage/messages
   *  ("broadcasts & reminders") — see t20-page-list.jsx:67. */
  subtitle?: ReactNode;
  /** Optional 15px ink-muted lede paragraph. max-w-[56ch] capped
   *  per design source. */
  description?: ReactNode;
  /** Optional pill / badge row rendered immediately below the
   *  description. Matches the design source's t20-page-list.jsx:67-72
   *  pattern (active-rubric pill + cycle pill). Caller controls
   *  the row layout — typically a `<div className="flex flex-wrap
   *  gap-2">` wrapping `<span>` pills. */
  meta?: ReactNode;
  /** Optional top-right action stack (CTAs, secondary buttons). */
  actions?: ReactNode;
  /** Background speckle layer. Default `{ density: "high", opacity:
   *  0.06 }` — matches the page-list.jsx hero values. Pass `false`
   *  to disable. */
  speckle?: SpeckleSpec;
  /** Corner splatter accent. Default `{ size: "L", variant: 1,
   *  rotate: -12, opacity: 0.6 }`. Pass `false` to disable. Pass an
   *  array to render multiple splatters (e.g. /manage/t20 has a
   *  primary L splatter + a secondary M splatter inset bottom-left). */
  splatter?: SplatterSpec | SplatterSpec[];
  /** Wrapper width tier. "list" → max-w-7xl, "form" →
   *  max-w-[1100px], "none" → no wrapper (caller owns the parent
   *  container). Default "list". */
  containerWidth?: "list" | "form" | "none";
  className?: string;
};

const CONTAINER_CLASSES: Record<NonNullable<Props["containerWidth"]>, string> = {
  list: "mx-auto max-w-7xl px-6 py-8 pb-24",
  form: "mx-auto max-w-[1100px] px-6 py-8 pb-24",
  none: "",
};

function resolveSplatterSize(size: SplatterSize | number | undefined): number {
  if (typeof size === "number") return size;
  return SPLATTER_SIZE[size ?? "L"];
}

function renderSplatter(spec: SplatterSpec, idx: number): ReactNode {
  if (spec === false) return null;
  const {
    preset = "atomic-red",
    variant = 1,
    size,
    rotate = -12,
    opacity = 0.6,
    top,
    right,
    bottom,
    left,
  } = spec;
  // Inset defaults: when neither bottom/left is passed, default to
  // top -40 / right -30 (per design source page-list / page-detail
  // hero corner splatter). When bottom OR left is passed, the
  // caller is pinning to a different corner — don't auto-add the
  // top/right defaults.
  const inset =
    bottom !== undefined || left !== undefined
      ? {
          ...(top !== undefined && top !== null ? { top } : {}),
          ...(right !== undefined && right !== null ? { right } : {}),
          ...(bottom !== undefined ? { bottom } : {}),
          ...(left !== undefined ? { left } : {}),
        }
      : { top: top ?? -40, right: right ?? -30 };
  return (
    <div
      key={`splatter-${idx}`}
      aria-hidden="true"
      className="pointer-events-none absolute z-[1]"
      style={{ ...inset, opacity }}
    >
      <SplatterAccent
        preset={preset}
        variant={variant}
        size={resolveSplatterSize(size)}
        rotate={rotate}
      />
    </div>
  );
}

export function AdminPageHero({
  title,
  eyebrow,
  subtitle,
  description,
  meta,
  actions,
  speckle = { density: "high", opacity: 0.06 },
  splatter = { size: "L", variant: 1, rotate: -12, opacity: 0.6 },
  containerWidth = "list",
  className,
}: Props) {
  const speckleEnabled = speckle !== false;
  const speckleSeed =
    speckleEnabled && speckle.seed
      ? speckle.seed
      : `admin-page-hero-${typeof title === "string" ? title : "untitled"}`;
  const speckleDensity = speckleEnabled ? speckle.density ?? "high" : "high";
  const speckleOpacity = speckleEnabled ? speckle.opacity ?? 0.06 : 0;

  const splatters = Array.isArray(splatter) ? splatter : [splatter];

  const hero = (
    <div
      data-slot="admin-page-hero"
      className={cn(
        // .page-hero from admin-styles.css:313-321 — radius 18, bg-bone,
        // border, mb-6 (24px) handled by the parent container.
        "relative overflow-hidden rounded-[18px] border border-border bg-bone",
        "isolate", // contain SplatterAccent's intrinsic rotate stacking
        className,
      )}
    >
      {speckleEnabled && (
        <div className="pointer-events-none absolute inset-0 z-0">
          <SpeckleLayer
            seed={speckleSeed}
            density={speckleDensity}
            opacity={speckleOpacity}
          />
        </div>
      )}
      {splatters.map((s, i) => renderSplatter(s, i))}

      {/* .page-hero-inner — padding 32 36 (= py-8 px-9), min-h 156,
          items-end, gap 32 (= gap-8), justify-between flex row. */}
      <div
        className="relative z-10 flex min-h-[156px] flex-wrap items-end justify-between gap-8 px-9 py-8"
      >
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div
              data-slot="admin-page-hero-eyebrow"
              className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted"
            >
              {eyebrow}
            </div>
          )}
          <h1
            data-slot="admin-page-hero-title"
            className="mt-1.5 font-display text-[56px] font-black leading-none tracking-tight"
          >
            {title}
          </h1>
          {subtitle && (
            <div
              data-slot="admin-page-hero-subtitle"
              className="mt-0.5 font-display text-[22px] font-bold italic text-ink-muted"
            >
              {subtitle}
            </div>
          )}
          {description && (
            <p
              data-slot="admin-page-hero-description"
              className="mt-2.5 max-w-[56ch] text-[15px] text-ink-muted"
            >
              {description}
            </p>
          )}
          {meta && (
            <div data-slot="admin-page-hero-meta" className="mt-3.5">
              {meta}
            </div>
          )}
        </div>
        {actions && (
          <div
            data-slot="admin-page-hero-actions"
            className="flex shrink-0 items-center gap-2"
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );

  if (containerWidth === "none") {
    return hero;
  }

  return (
    <div className={CONTAINER_CLASSES[containerWidth]}>
      {hero}
      {/* mb-6 (24px) baked in via design source — applied by the
          surface's content gap; AdminPageHero itself stays single-
          purpose and doesn't ship a margin. */}
    </div>
  );
}
