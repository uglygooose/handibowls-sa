import { describe, expect, it } from "vitest";

import {
  aggregateAssessment,
  type Delivery,
  gradeFor,
  scoreDelivery,
  sectionMaxes,
} from "@/lib/t20/score";
import { type Rubric, RubricSchema } from "@/lib/t20/rubric";

// Phase 10 — scoring engine unit tests.
//
// Tests are pinned to the v1-final-2026 rubric (migration 013 seed).
// Any future rubric upload that re-tunes points must come with a new
// migration + a re-validation pass on this test file before it ships.

const RUBRIC_V1: Rubric = RubricSchema.parse({
  version: "v1-final-2026",
  deliveriesPerRoundPerDistance: 8,
  rounds: 2,
  sections: {
    jacks: {
      distances_m: [23, 26, 29, 32],
      model: "line_outcome",
      points: { on_line: 1, narrow: 0.5, wide: 0 },
      max_per_distance: 16,
    },
    targets: {
      distances_m: [23, 26, 29, 32],
      model: "line_outcome",
      points: { on_line: 1, narrow: 0.5, wide: 0 },
      max_per_distance: 16,
    },
    drive: {
      distance_m: 28,
      model: "zones_8",
      hands: ["fore", "back"],
      zonePoints: {
        "1": 8,
        "2": 5,
        "3": 2,
        "4": 4,
        "5": 6,
        "6": 4,
        "7": 2,
        "8": 5,
        miss: 0,
      },
    },
    control: {
      distance_m: 28,
      model: "zones_8",
      hands: ["fore", "back"],
      zonePoints: {
        "1": 8,
        "2": 5,
        "3": 2,
        "4": 4,
        "5": 6,
        "6": 4,
        "7": 2,
        "8": 5,
        miss: 0,
      },
    },
    trail: {
      distance_m: 28,
      model: "zones_8",
      hands: ["fore", "back"],
      zonePoints: {
        "1": 8,
        "2": 5,
        "3": 2,
        "4": 4,
        "5": 6,
        "6": 4,
        "7": 2,
        "8": 5,
        miss: 0,
      },
    },
    speedhumps_asc: {
      ladder_m: [23, 26, 29, 32],
      model: "on_length",
      pointsPerOnLength: 2,
    },
    speedhumps_desc: {
      ladder_m: [32, 29, 26, 23],
      model: "on_length",
      pointsPerOnLength: 2,
    },
  },
  grading: [
    { grade: "gold", minPct: 80 },
    { grade: "silver", minPct: 65 },
    { grade: "bronze", minPct: 50 },
    { grade: "fail", minPct: 0 },
  ],
  passPctTarget: 60,
  assessor: { minLevel: 2, secondMarkerRecommended: true },
});

function lineOutcome(
  section: "jacks" | "targets",
  value: "on_line" | "narrow" | "wide" | null,
  distance_m = 23,
  delivery_index = 1,
  round: 1 | 2 = 1,
): Delivery {
  return {
    section,
    round,
    delivery_index,
    distance_m,
    outcome: { section_model: "line_outcome", value },
  };
}

function zone(
  section: "drive" | "control" | "trail",
  value: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | "miss" | null,
  delivery_index = 1,
  round: 1 | 2 = 1,
): Delivery {
  return {
    section,
    round,
    delivery_index,
    distance_m: 28,
    outcome: { section_model: "zones_8", value },
  };
}

function onLength(
  section: "speedhumps_asc" | "speedhumps_desc",
  value: boolean | null,
  distance_m: number,
  delivery_index = 1,
  round: 1 | 2 = 1,
): Delivery {
  return {
    section,
    round,
    delivery_index,
    distance_m,
    outcome: { section_model: "on_length", value },
  };
}

describe("scoreDelivery — line_outcome", () => {
  it("on_line scores 1pt", () => {
    expect(scoreDelivery(RUBRIC_V1, lineOutcome("jacks", "on_line"))).toBe(1);
  });

  it("narrow scores 0.5pt", () => {
    expect(scoreDelivery(RUBRIC_V1, lineOutcome("targets", "narrow"))).toBe(0.5);
  });

  it("wide scores 0pt", () => {
    expect(scoreDelivery(RUBRIC_V1, lineOutcome("jacks", "wide"))).toBe(0);
  });

  it("null/unscored delivery returns 0", () => {
    expect(scoreDelivery(RUBRIC_V1, lineOutcome("jacks", null))).toBe(0);
  });
});

describe("scoreDelivery — zones_8", () => {
  it("zone 1 (Front Centre) scores 8pt — the highest single-bowl reward", () => {
    expect(scoreDelivery(RUBRIC_V1, zone("drive", 1))).toBe(8);
  });

  it("zone 5 (Back Centre) scores 6pt", () => {
    expect(scoreDelivery(RUBRIC_V1, zone("control", 5))).toBe(6);
  });

  it("zones 2 and 8 (front shoulders) score 5pt", () => {
    expect(scoreDelivery(RUBRIC_V1, zone("trail", 2))).toBe(5);
    expect(scoreDelivery(RUBRIC_V1, zone("trail", 8))).toBe(5);
  });

  it("zones 4 and 6 (back shoulders) score 4pt", () => {
    expect(scoreDelivery(RUBRIC_V1, zone("drive", 4))).toBe(4);
    expect(scoreDelivery(RUBRIC_V1, zone("drive", 6))).toBe(4);
  });

  it("zones 3 and 7 (wide L/R) score 2pt", () => {
    expect(scoreDelivery(RUBRIC_V1, zone("control", 3))).toBe(2);
    expect(scoreDelivery(RUBRIC_V1, zone("control", 7))).toBe(2);
  });

  it("miss scores 0pt", () => {
    expect(scoreDelivery(RUBRIC_V1, zone("drive", "miss"))).toBe(0);
  });

  it("null delivery returns 0", () => {
    expect(scoreDelivery(RUBRIC_V1, zone("trail", null))).toBe(0);
  });
});

describe("scoreDelivery — on_length", () => {
  it("on length (true) scores 2pt", () => {
    expect(
      scoreDelivery(RUBRIC_V1, onLength("speedhumps_asc", true, 23)),
    ).toBe(2);
  });

  it("off length (false) scores 0pt", () => {
    expect(
      scoreDelivery(RUBRIC_V1, onLength("speedhumps_desc", false, 32)),
    ).toBe(0);
  });

  it("null delivery returns 0", () => {
    expect(
      scoreDelivery(RUBRIC_V1, onLength("speedhumps_asc", null, 26)),
    ).toBe(0);
  });
});

describe("sectionMaxes", () => {
  it("line_outcome sections (jacks, targets) cap at 64 (16pt × 4 distances)", () => {
    const m = sectionMaxes(RUBRIC_V1);
    expect(m.jacks).toBe(64);
    expect(m.targets).toBe(64);
  });

  it("zones_8 sections cap at 256 (theoretical, all zone-1)", () => {
    const m = sectionMaxes(RUBRIC_V1);
    // 8 deliveries × 2 hands × 2 rounds × 8pt(zone 1)
    expect(m.drive).toBe(256);
    expect(m.control).toBe(256);
    expect(m.trail).toBe(256);
  });

  it("on_length sections cap at 32 (4 ladder × 2 hands × 2 rounds × 2pt)", () => {
    const m = sectionMaxes(RUBRIC_V1);
    expect(m.speedhumps_asc).toBe(32);
    expect(m.speedhumps_desc).toBe(32);
  });
});

describe("gradeFor — band edge cases (plan-locked Q7)", () => {
  it("80.0% → gold", () => {
    expect(gradeFor(RUBRIC_V1, 80)).toBe("gold");
  });

  it("79.9% → silver (just under gold)", () => {
    expect(gradeFor(RUBRIC_V1, 79.9)).toBe("silver");
  });

  it("65.0% → silver (lower silver edge)", () => {
    expect(gradeFor(RUBRIC_V1, 65)).toBe("silver");
  });

  it("64.9% → bronze (just under silver)", () => {
    expect(gradeFor(RUBRIC_V1, 64.9)).toBe("bronze");
  });

  it("50.0% → bronze (lower bronze edge)", () => {
    expect(gradeFor(RUBRIC_V1, 50)).toBe("bronze");
  });

  it("49.9% → fail (just under bronze)", () => {
    expect(gradeFor(RUBRIC_V1, 49.9)).toBe("fail");
  });

  it("0% → fail", () => {
    expect(gradeFor(RUBRIC_V1, 0)).toBe("fail");
  });

  it("100% → gold", () => {
    expect(gradeFor(RUBRIC_V1, 100)).toBe("gold");
  });

  it("60% (passPctTarget) → bronze (above 50, below 65)", () => {
    expect(gradeFor(RUBRIC_V1, 60)).toBe("bronze");
  });
});

describe("aggregateAssessment — full roll-up", () => {
  it("empty deliveries → 0% fail", () => {
    const r = aggregateAssessment(RUBRIC_V1, []);
    expect(r.earned).toBe(0);
    expect(r.percentage).toBe(0);
    expect(r.grade).toBe("fail");
    expect(r.sectionTotals).toHaveLength(7);
  });

  it("a single zone-1 delivery on Drive scores 8 / grandMax 320", () => {
    const r = aggregateAssessment(RUBRIC_V1, [zone("drive", 1)]);
    expect(r.earned).toBe(8);
    expect(r.max).toBe(320);
    expect(r.percentage).toBeCloseTo(2.5, 4);
    expect(r.grade).toBe("fail");
  });

  it("scores roll into the right section bucket", () => {
    const deliveries: Delivery[] = [
      lineOutcome("jacks", "on_line"),
      lineOutcome("jacks", "on_line", 26, 2),
      zone("drive", 1),
      onLength("speedhumps_asc", true, 23),
    ];
    const r = aggregateAssessment(RUBRIC_V1, deliveries);
    const byKey = Object.fromEntries(
      r.sectionTotals.map((s) => [s.section, s.earned]),
    );
    expect(byKey.jacks).toBe(2);
    expect(byKey.drive).toBe(8);
    expect(byKey.speedhumps_asc).toBe(2);
    expect(byKey.targets).toBe(0);
    expect(byKey.control).toBe(0);
  });

  it("grand-max is the plan-locked 320 (not a sum of section theoretical maxes)", () => {
    const r = aggregateAssessment(RUBRIC_V1, []);
    expect(r.max).toBe(320);
  });

  it("scoring 256/320 (80.0%) → gold", () => {
    // 256 / 320 = 80% → gold (lower edge).
    // We synthesize 32 zone-1 deliveries on drive: 32 × 8 = 256.
    const deliveries: Delivery[] = [];
    for (let r = 1 as 1 | 2; r <= 2; r = (r + 1) as 1 | 2) {
      for (let i = 1; i <= 16; i++) {
        deliveries.push(zone("drive", 1, i, r));
      }
    }
    const result = aggregateAssessment(RUBRIC_V1, deliveries);
    expect(result.earned).toBe(256);
    expect(result.percentage).toBeCloseTo(80, 4);
    expect(result.grade).toBe("gold");
  });

  it("scoring 255/320 (79.69%) → silver (just under gold)", () => {
    // 31 × zone 1 (248) + 1 × zone 2 (5) + 1 × zone 8 (5) = 258 — too high.
    // Try: 31 × zone 1 (248) + 1 × zone 8 (5) = 253. Need 255.
    // 31 × zone 1 (248) + 1 × narrow on jacks targets is across sections.
    // Easiest: 30 × zone 1 (240) + 3 × zone 2 (15) = 255.
    const deliveries: Delivery[] = [];
    for (let i = 1; i <= 30; i++) deliveries.push(zone("drive", 1, i, 1));
    deliveries.push(zone("drive", 2, 31, 1));
    deliveries.push(zone("drive", 2, 32, 1));
    deliveries.push(zone("drive", 2, 1, 2));
    const result = aggregateAssessment(RUBRIC_V1, deliveries);
    expect(result.earned).toBe(255);
    expect(result.percentage).toBeCloseTo(79.6875, 3);
    expect(result.grade).toBe("silver");
  });

  it("scoring 160/320 (50.0%) → bronze (lower bronze edge)", () => {
    const deliveries: Delivery[] = [];
    // 20 × zone 1 = 160pt
    for (let i = 1; i <= 16; i++) deliveries.push(zone("drive", 1, i, 1));
    for (let i = 1; i <= 4; i++) deliveries.push(zone("control", 1, i, 1));
    const result = aggregateAssessment(RUBRIC_V1, deliveries);
    expect(result.earned).toBe(160);
    expect(result.percentage).toBe(50);
    expect(result.grade).toBe("bronze");
  });

  it("scoring 159/320 (49.69%) → fail (just under bronze)", () => {
    const deliveries: Delivery[] = [];
    // 19 × zone 1 (152) + 1 × zone 2 (5) + 1 × zone 5 (6) = 163. Too high.
    // Try 19 × zone 1 (152) + 1 × zone 4 (4) + 1 × zone 8 (5) = 161. Still too high.
    // 19 × zone 1 (152) + 1 × zone 4 (4) + 1 × zone 4 (4) = 160. Bronze.
    // Aim 159 exact: 19 × zone 1 (152) + 1 × zone 5 (6) + 1 × on_line jacks (1) = 159.
    for (let i = 1; i <= 16; i++) deliveries.push(zone("drive", 1, i, 1));
    for (let i = 1; i <= 3; i++) deliveries.push(zone("control", 1, i, 1));
    deliveries.push(zone("control", 5, 4, 1));
    deliveries.push(lineOutcome("jacks", "on_line"));
    const result = aggregateAssessment(RUBRIC_V1, deliveries);
    expect(result.earned).toBe(159);
    expect(result.percentage).toBeCloseTo(49.6875, 3);
    expect(result.grade).toBe("fail");
  });
});

// Phase 12 / 12-4 / M10 — round-split (R1 / R2) sub-totals on
// SectionTotal. Pre-12-4 the breakdown table rendered Math.round(
// earned/2) per row as a presentation stand-in. The aggregate now
// returns the real per-round split so the table can render honest
// values that reflect whether a player improved between rounds.

describe("aggregateAssessment — R1 / R2 round split (12-4 / M10)", () => {
  it("empty deliveries → r1=r2=0 across every section", () => {
    const r = aggregateAssessment(RUBRIC_V1, []);
    for (const t of r.sectionTotals) {
      expect(t.r1).toBe(0);
      expect(t.r2).toBe(0);
      expect(t.earned).toBe(0);
    }
  });

  it("a single R1 zone-1 delivery on Drive → r1=8, r2=0", () => {
    const r = aggregateAssessment(RUBRIC_V1, [zone("drive", 1, 1, 1)]);
    const drive = r.sectionTotals.find((s) => s.section === "drive");
    expect(drive?.r1).toBe(8);
    expect(drive?.r2).toBe(0);
    expect(drive?.earned).toBe(8);
  });

  it("a single R2 zone-1 delivery on Drive → r1=0, r2=8", () => {
    const r = aggregateAssessment(RUBRIC_V1, [zone("drive", 1, 1, 2)]);
    const drive = r.sectionTotals.find((s) => s.section === "drive");
    expect(drive?.r1).toBe(0);
    expect(drive?.r2).toBe(8);
    expect(drive?.earned).toBe(8);
  });

  it("mixed R1+R2 deliveries on a section sum to .earned (r1+r2 invariant)", () => {
    const deliveries: Delivery[] = [
      zone("drive", 1, 1, 1), // R1: 8pt
      zone("drive", 2, 2, 1), // R1: 5pt
      zone("drive", 1, 1, 2), // R2: 8pt
      zone("drive", 4, 2, 2), // R2: 4pt
    ];
    const r = aggregateAssessment(RUBRIC_V1, deliveries);
    const drive = r.sectionTotals.find((s) => s.section === "drive");
    expect(drive?.r1).toBe(13);
    expect(drive?.r2).toBe(12);
    expect(drive?.earned).toBe(25);
    expect(drive!.r1 + drive!.r2).toBe(drive!.earned);
  });

  it("section R1+R2 invariant holds across every section in a mixed assessment", () => {
    const deliveries: Delivery[] = [
      lineOutcome("jacks", "on_line", 23, 1, 1),
      lineOutcome("jacks", "narrow", 26, 2, 2),
      lineOutcome("targets", "on_line", 23, 1, 1),
      zone("drive", 1, 1, 1),
      zone("drive", 5, 2, 2),
      zone("control", 8, 1, 1),
      zone("trail", 3, 1, 2),
      onLength("speedhumps_asc", true, 23, 1, 1),
      onLength("speedhumps_asc", false, 26, 2, 2),
      onLength("speedhumps_desc", true, 32, 1, 1),
    ];
    const r = aggregateAssessment(RUBRIC_V1, deliveries);
    for (const t of r.sectionTotals) {
      expect(t.r1 + t.r2).toBe(t.earned);
    }
  });
});

describe("RubricSchema — Zod validation", () => {
  it("rejects rubric with missing required section", () => {
    const broken = JSON.parse(JSON.stringify(RUBRIC_V1)) as Record<
      string,
      unknown
    >;
    delete (broken.sections as Record<string, unknown>).drive;
    const result = RubricSchema.safeParse(broken);
    expect(result.success).toBe(false);
  });

  it("rejects rubric with malformed grading band (out-of-range minPct)", () => {
    const broken = JSON.parse(JSON.stringify(RUBRIC_V1)) as Rubric;
    broken.grading[0].minPct = 150;
    expect(RubricSchema.safeParse(broken).success).toBe(false);
  });

  it("accepts the v1-final-2026 seed shape", () => {
    expect(RubricSchema.safeParse(RUBRIC_V1).success).toBe(true);
  });
});
