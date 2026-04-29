import { cn } from "@/lib/utils";

import type { Grade } from "@/lib/t20/rubric";

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
// renders with a metallic gradient + star sigil; Silver maps to the
// active club preset's primary; Bronze uses a muted brown gradient;
// Reassess (fail) uses the inverse ink scheme. Density is part of
// the design and must not be softened.

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
    const styles = {
      gold: {
        bg: "linear-gradient(140deg, #f5cf52 0%, #d4a000 65%, #a87c00 100%)",
        ink: "#0a0a0a",
        shadow:
          "0 14px 28px -8px rgba(212,160,0,0.45), inset 0 1px 0 rgba(255,255,255,0.5)",
        border: undefined as string | undefined,
      },
      silver: {
        bg: "var(--primary-500)",
        ink: "var(--on-primary)",
        shadow:
          "0 14px 28px -8px color-mix(in srgb, var(--primary-500) 45%, transparent), inset 0 1px 0 rgba(255,255,255,0.18)",
        border: undefined as string | undefined,
      },
      bronze: {
        bg: "linear-gradient(140deg, #c08758 0%, #8a6230 60%, #5e4220 100%)",
        ink: "#fafaf7",
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

  // Compact pills (sm | md)
  const styles = {
    gold: { bg: "linear-gradient(120deg, #f5cf52, #d4a000)", ink: "#0a0a0a" },
    silver: { bg: "var(--primary-500)", ink: "var(--on-primary)" },
    bronze: { bg: "linear-gradient(120deg, #b27a48, #8a6230)", ink: "#fafaf7" },
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
