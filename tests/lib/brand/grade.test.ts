import { describe, expect, it } from "vitest";

import {
  GRADE_COLORS,
  type GradeKey,
  gradeHeroGradient,
  gradePillCompactGradient,
  gradePillGradient,
} from "@/lib/brand/grade";

// Phase 12.5 / 12.5-2 (audit id `grade-color-extraction`): pin
// the GRADE_COLORS contract — every consumer (admin t20 hero,
// GradePill, future player /t20 detail view) reads from this
// single source.

describe("GRADE_COLORS", () => {
  const TIERS: GradeKey[] = ["gold", "silver", "bronze", "fail", "ungraded"];

  for (const tier of TIERS) {
    it(`exposes from / mid / to / ink for ${tier}`, () => {
      const c = GRADE_COLORS[tier];
      expect(c).toBeDefined();
      expect(c.from).toBeTypeOf("string");
      expect(c.mid).toBeTypeOf("string");
      expect(c.to).toBeTypeOf("string");
      expect(c.ink).toBeTypeOf("string");
      expect(c.from.length).toBeGreaterThan(0);
      expect(c.to.length).toBeGreaterThan(0);
      expect(c.ink.length).toBeGreaterThan(0);
    });
  }

  it("uses fixed hex literals for gold + silver + bronze + fail (not theme tokens)", () => {
    // Locked decision (12.5-2 prompt): silver gets a FIXED gradient
    // like gold/bronze. Pre-12.5-2 silver was theme-derived
    // (var(--primary-300/500/700)); the regression-guard here is
    // that silver doesn't drift back to theme tokens.
    expect(GRADE_COLORS.gold.from).toMatch(/^#/);
    expect(GRADE_COLORS.silver.from).toMatch(/^#/);
    expect(GRADE_COLORS.silver.mid).toMatch(/^#/);
    expect(GRADE_COLORS.silver.to).toMatch(/^#/);
    expect(GRADE_COLORS.bronze.from).toMatch(/^#/);
    expect(GRADE_COLORS.fail.from).toMatch(/^#/);
  });

  it("uses theme-token strings for ungraded (inert chrome, not a tier visual)", () => {
    expect(GRADE_COLORS.ungraded.from).toContain("var(--");
    expect(GRADE_COLORS.ungraded.ink).toContain("var(--");
  });
});

describe("gradeHeroGradient", () => {
  it("produces a 135deg 3-stop linear-gradient string per tier", () => {
    expect(gradeHeroGradient("gold")).toBe(
      "linear-gradient(135deg, #f5cf52 0%, #d4a000 50%, #8a6300 100%)",
    );
    expect(gradeHeroGradient("bronze")).toBe(
      "linear-gradient(135deg, #c08758 0%, #8a6230 50%, #4a3520 100%)",
    );
  });

  it("produces silver with the locked fixed gradient (not theme-derived)", () => {
    const silver = gradeHeroGradient("silver");
    expect(silver).toContain("#"); // hex literals
    expect(silver).not.toContain("var(--primary-"); // not theme-derived
    expect(silver.startsWith("linear-gradient(135deg,")).toBe(true);
  });
});

describe("gradePillGradient + gradePillCompactGradient", () => {
  it("gradePillGradient is the 140deg 3-stop pill variant", () => {
    expect(gradePillGradient("gold")).toBe(
      "linear-gradient(140deg, #f5cf52 0%, #d4a000 65%, #8a6300 100%)",
    );
  });

  it("gradePillCompactGradient is the 120deg 2-stop legacy variant", () => {
    expect(gradePillCompactGradient("gold")).toBe(
      "linear-gradient(120deg, #f5cf52, #8a6300)",
    );
  });
});
