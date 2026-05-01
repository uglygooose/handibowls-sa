import { GRADE_COLORS, gradePillCompactGradient, gradePillGradient } from "@/lib/brand/grade";
import type { Grade } from "@/lib/t20/rubric";
import { cn } from "@/lib/utils";

// Phase 10 — Twenty 20 grade pill.
//
// Three sizes:
//   sm  — 22h compact pill for table cells + assessment cards
//   md  — 28h pill for setup-form preview slots
//   lg  — hero pill, 96px Barlow Black, used by the results view's
//         grade-reveal moment. The user-visible label drops the
//         "Fail" bowls term in favour of "Reassess" — matching the
//         design source's coaching tone (the schema enum is still
//         `fail` per migration 001).
//
// Per-grade visual treatment is intentionally distinct — Gold
// renders with a metallic gradient + star sigil; Silver renders
// with a fixed cool-metallic gradient (12.5-2 locked-decision —
// silver no longer derives from the active club preset so it
// looks the same across every preset); Bronze uses a muted brown
// gradient; Reassess (fail) uses the inverse ink scheme. Density
// is part of the design and must not be softened.
//
// Phase 12.5 / 12.5-2 (audit id `grade-color-extraction`): all
// hex literals moved to `lib/brand/grade.ts` (`GRADE_COLORS` +
// `gradePillGradient` / `gradePillCompactGradient` helpers). This
// component now consumes the constant; any future grade visual
// reads from the same source.

export type GradePillSize = "sm" | "md" | "lg";

type Props = {
  grade: Grade;
  size?: GradePillSize;
  className?: string;
};

const LABEL: Record<Grade, string> = {
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  fail: "Reassess",
};

export function GradePill({ grade, size = "md", className }: Props) {
  if (size === "lg") {
    // Tier shadows + border are pill-specific affordances kept here
    // (GRADE_COLORS only provides gradient stops + ink). `fail` keeps
    // its solid `--ink` treatment + outlined border instead of using
    // the dark-grey gradient; that's the existing design contract.
    const styles = {
      gold: {
        bg: gradePillGradient("gold"),
        ink: GRADE_COLORS.gold.ink,
        shadow:
          "0 14px 28px -8px rgba(212,160,0,0.45), inset 0 1px 0 rgba(255,255,255,0.5)",
        border: undefined as string | undefined,
      },
      silver: {
        bg: gradePillGradient("silver"),
        ink: GRADE_COLORS.silver.ink,
        shadow:
          "0 14px 28px -8px rgba(120,122,124,0.45), inset 0 1px 0 rgba(255,255,255,0.4)",
        border: undefined as string | undefined,
      },
      bronze: {
        bg: gradePillGradient("bronze"),
        ink: GRADE_COLORS.bronze.ink,
        shadow: "0 8px 18px -8px rgba(94,66,32,0.35)",
        border: undefined as string | undefined,
      },
      fail: {
        bg: "var(--ink)",
        ink: "var(--ink-inverse)",
        shadow: "none",
        border: "2px solid var(--ink)",
      },
    }[grade];
    return (
      <div
        data-slot="grade-pill"
        data-grade={grade}
        data-size="lg"
        className={cn(
          "relative inline-flex items-baseline gap-[10px] rounded-[18px] px-9 pt-[14px] pb-[18px] uppercase",
          "font-display font-black italic",
          className,
        )}
        style={{
          background: styles.bg,
          color: styles.ink,
          boxShadow: styles.shadow,
          letterSpacing: "-0.02em",
          fontSize: 96,
          lineHeight: 0.95,
          border: styles.border,
        }}
      >
        <span>{LABEL[grade]}</span>
        {grade === "gold" && (
          <span aria-hidden="true" style={{ fontSize: 32, opacity: 0.9, fontStyle: "normal" }}>
            ★
          </span>
        )}
      </div>
    );
  }

  // Compact pills (sm | md). `fail` keeps its solid `--ink`
  // treatment for the high-contrast inverse look; the other tiers
  // pick from the shared GRADE_COLORS via `gradePillCompactGradient`.
  const styles = {
    gold: { bg: gradePillCompactGradient("gold"), ink: GRADE_COLORS.gold.ink },
    silver: { bg: gradePillCompactGradient("silver"), ink: GRADE_COLORS.silver.ink },
    bronze: { bg: gradePillCompactGradient("bronze"), ink: GRADE_COLORS.bronze.ink },
    fail: { bg: "var(--ink)", ink: "var(--ink-inverse)" },
  }[grade];
  const isSm = size === "sm";
  return (
    <span
      data-slot="grade-pill"
      data-grade={grade}
      data-size={size}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full uppercase",
        "font-display font-black italic tracking-[0.06em]",
        isSm ? "h-[22px] px-2.5 text-[11.5px]" : "h-7 px-3.5 text-[13px]",
        className,
      )}
      style={{ background: styles.bg, color: styles.ink }}
    >
      {LABEL[grade]}
    </span>
  );
}
