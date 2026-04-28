import { describe, expect, it } from "vitest";
import { FORMAT_DEFAULTS, type TournamentFormat } from "@/lib/tournaments/formats";

// Per HANDIBOWLS_REBUILD_PLAN.md §9 step 3 — exact values are the contract.
// Triples is FIRST-CLASS per Q9, not aliased to pairs or fours.

describe("FORMAT_DEFAULTS", () => {
  it("covers all 5 BSA disciplines", () => {
    const formats: TournamentFormat[] = [
      "singles",
      "pairs",
      "triples",
      "fours",
      "mixed_pairs",
    ];
    for (const f of formats) {
      expect(FORMAT_DEFAULTS[f]).toBeDefined();
    }
    expect(Object.keys(FORMAT_DEFAULTS)).toHaveLength(5);
  });

  it("singles — 4 bowls, shots_up scoring, 21 shots target", () => {
    expect(FORMAT_DEFAULTS.singles).toEqual({
      bowlsPerPlayer: 4,
      scoringModel: "shots_up",
      shotsTarget: 21,
    });
  });

  it("pairs — 3 bowls, fixed_ends scoring, 18 ends target", () => {
    expect(FORMAT_DEFAULTS.pairs).toEqual({
      bowlsPerPlayer: 3,
      scoringModel: "fixed_ends",
      endsTarget: 18,
    });
  });

  it("triples — 3 bowls, fixed_ends scoring, 18 ends target (FIRST-CLASS, NOT pairs/fours alias)", () => {
    expect(FORMAT_DEFAULTS.triples).toEqual({
      bowlsPerPlayer: 3,
      scoringModel: "fixed_ends",
      endsTarget: 18,
    });
    // Identity check — must be its own object, not a reference to pairs.
    expect(FORMAT_DEFAULTS.triples).not.toBe(FORMAT_DEFAULTS.pairs);
    expect(FORMAT_DEFAULTS.triples).not.toBe(FORMAT_DEFAULTS.fours);
  });

  it("fours — 2 bowls, fixed_ends scoring, 15 ends target", () => {
    expect(FORMAT_DEFAULTS.fours).toEqual({
      bowlsPerPlayer: 2,
      scoringModel: "fixed_ends",
      endsTarget: 15,
    });
  });

  it("mixed_pairs — 3 bowls, fixed_ends scoring, 18 ends target", () => {
    expect(FORMAT_DEFAULTS.mixed_pairs).toEqual({
      bowlsPerPlayer: 3,
      scoringModel: "fixed_ends",
      endsTarget: 18,
    });
  });

  it("only singles uses shots_up scoring; everything else is fixed_ends", () => {
    expect(FORMAT_DEFAULTS.singles.scoringModel).toBe("shots_up");
    for (const f of ["pairs", "triples", "fours", "mixed_pairs"] as TournamentFormat[]) {
      expect(FORMAT_DEFAULTS[f].scoringModel).toBe("fixed_ends");
    }
  });

  it("scoring-model discriminated union — fixed_ends formats expose endsTarget, shots_up exposes shotsTarget", () => {
    const singles = FORMAT_DEFAULTS.singles;
    if (singles.scoringModel === "shots_up") {
      expect(singles.shotsTarget).toBe(21);
    }

    const pairs = FORMAT_DEFAULTS.pairs;
    if (pairs.scoringModel === "fixed_ends") {
      expect(pairs.endsTarget).toBe(18);
    }
  });
});
