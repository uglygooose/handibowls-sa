import { describe, expect, it } from "vitest";

import { diffRubrics, summariseDiff } from "@/lib/t20/diff";
import { type Rubric, RubricSchema } from "@/lib/t20/rubric";

// Phase 10 / 10-8 — domain-aware rubric diff tests.

const V1: Rubric = RubricSchema.parse({
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
      zonePoints: { "1": 8, "2": 5, "3": 2, "4": 4, "5": 6, "6": 4, "7": 2, "8": 5, miss: 0 },
    },
    control: {
      distance_m: 28,
      model: "zones_8",
      hands: ["fore", "back"],
      zonePoints: { "1": 8, "2": 5, "3": 2, "4": 4, "5": 6, "6": 4, "7": 2, "8": 5, miss: 0 },
    },
    trail: {
      distance_m: 28,
      model: "zones_8",
      hands: ["fore", "back"],
      zonePoints: { "1": 8, "2": 5, "3": 2, "4": 4, "5": 6, "6": 4, "7": 2, "8": 5, miss: 0 },
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

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

describe("diffRubrics — identity", () => {
  it("two identical rubrics yield zero changes", () => {
    expect(diffRubrics(V1, clone(V1))).toEqual([]);
  });
});

describe("diffRubrics — grading bands", () => {
  it("raised gold threshold emits a 'changed' entry with direction word", () => {
    const incoming = clone(V1);
    const goldBand = incoming.grading.find((g) => g.grade === "gold");
    if (goldBand) goldBand.minPct = 82;
    const changes = diffRubrics(V1, incoming);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      kind: "changed",
      path: "grading.gold.minPct",
      from: "≥ 80%",
      to: "≥ 82%",
    });
    expect(changes[0].label).toMatch(/Gold threshold raised/);
  });

  it("lowered silver threshold uses 'lowered' direction word", () => {
    const incoming = clone(V1);
    const silverBand = incoming.grading.find((g) => g.grade === "silver");
    if (silverBand) silverBand.minPct = 60;
    const changes = diffRubrics(V1, incoming);
    expect(changes[0].label).toMatch(/Silver threshold lowered/);
  });
});

describe("diffRubrics — passPctTarget", () => {
  it("emits a 'changed' entry when passPctTarget shifts", () => {
    const incoming = clone(V1);
    incoming.passPctTarget = 65;
    const changes = diffRubrics(V1, incoming);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      kind: "changed",
      path: "passPctTarget",
    });
    expect(changes[0].label).toContain("60% → 65%");
  });
});

describe("diffRubrics — assessor", () => {
  it("minLevel change emits a 'changed' entry", () => {
    const incoming = clone(V1);
    incoming.assessor.minLevel = 3;
    const changes = diffRubrics(V1, incoming);
    expect(changes).toHaveLength(1);
    expect(changes[0].path).toBe("assessor.minLevel");
    expect(changes[0].from).toBe("L2");
    expect(changes[0].to).toBe("L3");
  });

  it("toggling secondMarkerRecommended emits a friendly label", () => {
    const incoming = clone(V1);
    incoming.assessor.secondMarkerRecommended = false;
    const changes = diffRubrics(V1, incoming);
    expect(changes).toHaveLength(1);
    expect(changes[0].label).toContain("no longer recommended");
  });
});

describe("diffRubrics — sections", () => {
  it("model change emits one 'changed' line and stops further per-model diffs for that section", () => {
    const incoming = clone(V1);
    // Force jacks (line_outcome) to look like a zones_8 section.
    (incoming.sections.jacks as unknown as Record<string, unknown>).model = "zones_8";
    const changes = diffRubrics(V1, incoming);
    const jacksChanges = changes.filter((c) =>
      c.path.startsWith("sections.jacks."),
    );
    expect(jacksChanges).toHaveLength(1);
    expect(jacksChanges[0].path).toBe("sections.jacks.model");
  });

  it("zone point retune emits per-zone 'changed' entries", () => {
    const incoming = clone(V1);
    incoming.sections.drive.zonePoints["1"] = 9;
    incoming.sections.drive.zonePoints["5"] = 7;
    const changes = diffRubrics(V1, incoming).filter((c) =>
      c.path.startsWith("sections.drive.zonePoints"),
    );
    expect(changes).toHaveLength(2);
    expect(changes[0]).toMatchObject({
      kind: "changed",
      path: "sections.drive.zonePoints.1",
      from: 8,
      to: 9,
    });
    expect(changes[1]).toMatchObject({
      kind: "changed",
      path: "sections.drive.zonePoints.5",
      from: 6,
      to: 7,
    });
  });

  it("line_outcome distance change emits a single 'changed' entry with array stringification", () => {
    const incoming = clone(V1);
    incoming.sections.jacks.distances_m = [25, 28, 31, 34];
    const changes = diffRubrics(V1, incoming);
    expect(changes).toHaveLength(1);
    expect(changes[0].path).toBe("sections.jacks.distances_m");
    expect(changes[0].from).toBe("[23, 26, 29, 32]");
    expect(changes[0].to).toBe("[25, 28, 31, 34]");
  });

  it("on_length pointsPerOnLength shift emits a 'changed' entry per affected section", () => {
    const incoming = clone(V1);
    incoming.sections.speedhumps_asc.pointsPerOnLength = 3;
    incoming.sections.speedhumps_desc.pointsPerOnLength = 3;
    const changes = diffRubrics(V1, incoming);
    expect(changes).toHaveLength(2);
    expect(changes[0].path).toBe("sections.speedhumps_asc.pointsPerOnLength");
    expect(changes[1].path).toBe("sections.speedhumps_desc.pointsPerOnLength");
  });

  it("line_outcome max_per_distance change emits a 'changed' entry", () => {
    const incoming = clone(V1);
    incoming.sections.targets.max_per_distance = 24;
    const changes = diffRubrics(V1, incoming);
    expect(changes).toHaveLength(1);
    expect(changes[0].path).toBe("sections.targets.max_per_distance");
    expect(changes[0].from).toBe(16);
    expect(changes[0].to).toBe(24);
  });
});

describe("summariseDiff", () => {
  it("counts each kind", () => {
    const summary = summariseDiff([
      { kind: "added", path: "x", label: "a", from: null, to: 1 },
      { kind: "removed", path: "y", label: "b", from: 1, to: null },
      { kind: "changed", path: "z", label: "c", from: 1, to: 2 },
      { kind: "changed", path: "w", label: "d", from: 1, to: 2 },
    ]);
    expect(summary).toEqual({
      total: 4,
      added: 1,
      removed: 1,
      changed: 2,
    });
  });

  it("empty array → zeros", () => {
    expect(summariseDiff([])).toEqual({
      total: 0,
      added: 0,
      removed: 0,
      changed: 0,
    });
  });
});
