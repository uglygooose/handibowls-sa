// Phase 12.5 / 12.5-2 (audit id `grade-color-extraction`):
// canonical source for Twenty 20 grade-tier colours. Consumed by
// `<GradePill>` + the admin t20 results hero gradient + any future
// surface that visualises a grade tier (player /t20 detail view in
// 12.5-4 will be the next consumer).
//
// **Locked decision:** silver is a FIXED gradient, not derived
// from the active club preset's `--primary-*` tokens. Gold and
// bronze are inherently fixed (metallic). Silver was theme-derived
// pre-12.5-2; the audit + user decision standardised it so silver
// reads as silver across every preset.
//
// **Codified rule:** only grade-tier decoration may use non-theme
// hex literals. Everything else flows through `--primary-*` /
// `--speckle-*` / `--ink-*` tokens.

import type { Grade } from "@/lib/t20/rubric";

/** Internal-extension key for surfaces that need a colour for a
 *  not-yet-graded assessment row. The `Grade` enum (migration 001)
 *  caps at `gold | silver | bronze | fail`; "ungraded" is a UI-only
 *  fallthrough state — admin t20 list rows + player /t20 past-list
 *  rows during the brief window when a finalize is pending. */
export type GradeKey = Grade | "ungraded";

export type GradeGradient = {
  /** First gradient stop (lightest). */
  from: string;
  /** Middle gradient stop. */
  mid: string;
  /** Last gradient stop (deepest). */
  to: string;
  /** Foreground ink colour for text rendered on the gradient. */
  ink: string;
};

/** The single source of truth for grade-tier colours.
 *
 *  Hex values for `gold`, `bronze`, and `fail` are the design
 *  source's `t20-page-results.jsx` heroBg literals (the canonical
 *  reference per the audit). `silver` is a neutral cool-metallic
 *  set picked at 12.5-2 per the locked user decision. `ungraded`
 *  resolves through theme tokens since the row is meant to read
 *  as inert chrome, not a tier visual. */
export const GRADE_COLORS: Record<GradeKey, GradeGradient> = {
  gold: {
    from: "#f5cf52",
    mid: "#d4a000",
    to: "#8a6300",
    ink: "#0a0a0a",
  },
  silver: {
    // Locked-decision fixed silver gradient (see top-of-file note).
    // Cool-neutral metallic — reads "silver" without being preset-
    // tinted on warm primaries (atomic-red) or cold ones (ocean-blue).
    from: "#e6e7e9",
    mid: "#b1b2b4",
    to: "#6f7173",
    ink: "#0a0a0a",
  },
  bronze: {
    from: "#c08758",
    mid: "#8a6230",
    to: "#4a3520",
    ink: "#fafaf7",
  },
  fail: {
    // Two-stop in the design source (`#2a2a28 0%, #0f0f0e 100%`);
    // interpolated mid-stop here so `gradeHeroGradient` produces a
    // 3-stop string consistent with the other tiers.
    from: "#2a2a28",
    mid: "#1a1a18",
    to: "#0f0f0e",
    ink: "#fafaf7",
  },
  ungraded: {
    from: "var(--bone)",
    mid: "var(--surface-muted)",
    to: "var(--surface)",
    ink: "var(--ink)",
  },
};

/** 135deg 3-stop hero gradient — the canonical large-surface
 *  treatment for `/manage/t20/[id]` and the upcoming player
 *  `/t20/[assessmentId]` results detail view (12.5-4). */
export function gradeHeroGradient(grade: GradeKey): string {
  const c = GRADE_COLORS[grade];
  return `linear-gradient(135deg, ${c.from} 0%, ${c.mid} 50%, ${c.to} 100%)`;
}

/** 140deg 3-stop pill gradient — the sm/md/lg `<GradePill>`
 *  variant. Same colour set as the hero, slightly different angle
 *  to read as a pill rather than a sheet. */
export function gradePillGradient(grade: GradeKey): string {
  const c = GRADE_COLORS[grade];
  return `linear-gradient(140deg, ${c.from} 0%, ${c.mid} 65%, ${c.to} 100%)`;
}

/** 120deg 2-stop compact gradient — sm/md `<GradePill>` (legacy
 *  compact variant that elides the mid-stop). Kept for surfaces
 *  that previously used the 2-stop shape; new consumers should
 *  prefer `gradePillGradient`. */
export function gradePillCompactGradient(grade: GradeKey): string {
  const c = GRADE_COLORS[grade];
  return `linear-gradient(120deg, ${c.from}, ${c.to})`;
}
