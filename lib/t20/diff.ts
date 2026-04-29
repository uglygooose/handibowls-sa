// Phase 10 / 10-8 — domain-aware rubric diff.
//
// Walks two rubrics (active + incoming) and emits structured changes
// the RubricDiff component renders as a unified diff. Domain-aware,
// not a generic JSON diff — we know what fields matter and frame each
// change in user-visible terms (e.g. "Gold band raised 80% → 82%"
// rather than "grading[0].minPct: 80 → 82").
//
// Three change kinds (per RubricChange in components/t20/RubricDiff):
//   added    | path appears in incoming but not active
//   removed  | path appears in active but not incoming
//   changed  | both have it but values differ
//
// Coverage (v1):
//   • grading bands (Gold / Silver / Bronze / Fail thresholds)
//   • passPctTarget
//   • per-section: model, distances/ladder, hands list,
//     line_outcome.points, zones_8.zonePoints, on_length.pointsPerOnLength,
//     line_outcome.max_per_distance
//   • assessor.minLevel + assessor.secondMarkerRecommended
//
// Uncovered for v1 (flag if needed): structural section
// add/remove. The seeded v1 has 7 fixed sections; future v2 may
// add/remove (plan §13 mentions Approach as a v2 candidate). When
// that lands, extend this module to walk the section list as a set
// rather than per-key.

import {
  type Grade,
  type Rubric,
  SECTION_KEYS,
  type SectionKey,
} from "./rubric";

import type { RubricChange } from "@/components/t20/RubricDiff";

const GRADE_LABEL: Record<Grade, string> = {
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  fail: "Fail",
};

const SECTION_LABEL: Record<SectionKey, string> = {
  jacks: "Jacks",
  targets: "Targets",
  drive: "Drive",
  control: "Control",
  trail: "Trail",
  speedhumps_asc: "Speedhumps Ascending",
  speedhumps_desc: "Speedhumps Descending",
};

export function diffRubrics(active: Rubric, incoming: Rubric): RubricChange[] {
  const out: RubricChange[] = [];

  diffGrading(active, incoming, out);
  diffPassPct(active, incoming, out);
  diffAssessor(active, incoming, out);
  for (const key of SECTION_KEYS) {
    diffSection(active, incoming, key, out);
  }

  return out;
}

function diffGrading(a: Rubric, b: Rubric, out: RubricChange[]) {
  // Sort by grade key for deterministic output. Each grade is keyed
  // by its string identifier; if both rubrics carry the same set of
  // bands, a missing one is structurally meaningful (someone removed
  // a band).
  const keys: Grade[] = ["gold", "silver", "bronze", "fail"];
  const aBands = new Map(a.grading.map((g) => [g.grade as Grade, g.minPct]));
  const bBands = new Map(b.grading.map((g) => [g.grade as Grade, g.minPct]));
  for (const k of keys) {
    const av = aBands.get(k);
    const bv = bBands.get(k);
    if (av == null && bv != null) {
      out.push({
        kind: "added",
        path: `grading.${k}.minPct`,
        label: `${GRADE_LABEL[k]} band added at ${bv}%`,
        from: null,
        to: `≥ ${bv}%`,
      });
    } else if (av != null && bv == null) {
      out.push({
        kind: "removed",
        path: `grading.${k}.minPct`,
        label: `${GRADE_LABEL[k]} band removed`,
        from: `≥ ${av}%`,
        to: null,
      });
    } else if (av != null && bv != null && av !== bv) {
      const direction = bv > av ? "raised" : "lowered";
      out.push({
        kind: "changed",
        path: `grading.${k}.minPct`,
        label: `${GRADE_LABEL[k]} threshold ${direction} ${av}% → ${bv}%`,
        from: `≥ ${av}%`,
        to: `≥ ${bv}%`,
      });
    }
  }
}

function diffPassPct(a: Rubric, b: Rubric, out: RubricChange[]) {
  if (a.passPctTarget !== b.passPctTarget) {
    out.push({
      kind: "changed",
      path: "passPctTarget",
      label: `Pass target ${a.passPctTarget}% → ${b.passPctTarget}%`,
      from: `${a.passPctTarget}%`,
      to: `${b.passPctTarget}%`,
    });
  }
}

function diffAssessor(a: Rubric, b: Rubric, out: RubricChange[]) {
  if (a.assessor.minLevel !== b.assessor.minLevel) {
    out.push({
      kind: "changed",
      path: "assessor.minLevel",
      label: `Minimum coach level ${a.assessor.minLevel} → ${b.assessor.minLevel}`,
      from: `L${a.assessor.minLevel}`,
      to: `L${b.assessor.minLevel}`,
    });
  }
  if (
    a.assessor.secondMarkerRecommended !== b.assessor.secondMarkerRecommended
  ) {
    out.push({
      kind: "changed",
      path: "assessor.secondMarkerRecommended",
      label: b.assessor.secondMarkerRecommended
        ? "Second marker now recommended"
        : "Second marker no longer recommended",
      from: String(a.assessor.secondMarkerRecommended),
      to: String(b.assessor.secondMarkerRecommended),
    });
  }
}

function diffSection(
  a: Rubric,
  b: Rubric,
  key: SectionKey,
  out: RubricChange[],
) {
  const sa = a.sections[key];
  const sb = b.sections[key];
  const label = SECTION_LABEL[key];

  if (sa.model !== sb.model) {
    out.push({
      kind: "changed",
      path: `sections.${key}.model`,
      label: `${label} model ${sa.model} → ${sb.model}`,
      from: sa.model,
      to: sb.model,
    });
    // When the model changes, the per-model fields don't match shapes.
    // Stop here for this section — caller can still see the model
    // change as a single line.
    return;
  }

  if (sa.model === "line_outcome" && sb.model === "line_outcome") {
    diffArray(
      `sections.${key}.distances_m`,
      `${label} distances`,
      sa.distances_m,
      sb.distances_m,
      out,
    );
    diffNumber(
      `sections.${key}.points.on_line`,
      `${label} on-line point value`,
      sa.points.on_line,
      sb.points.on_line,
      out,
    );
    diffNumber(
      `sections.${key}.points.narrow`,
      `${label} narrow point value`,
      sa.points.narrow,
      sb.points.narrow,
      out,
    );
    diffNumber(
      `sections.${key}.points.wide`,
      `${label} wide point value`,
      sa.points.wide,
      sb.points.wide,
      out,
    );
    diffNumber(
      `sections.${key}.max_per_distance`,
      `${label} max per distance`,
      sa.max_per_distance,
      sb.max_per_distance,
      out,
    );
  } else if (sa.model === "zones_8" && sb.model === "zones_8") {
    diffNumber(
      `sections.${key}.distance_m`,
      `${label} distance`,
      sa.distance_m,
      sb.distance_m,
      out,
    );
    diffArray(
      `sections.${key}.hands`,
      `${label} hands`,
      sa.hands,
      sb.hands,
      out,
    );
    // Per-zone point values
    for (const z of ["1", "2", "3", "4", "5", "6", "7", "8", "miss"] as const) {
      const av = sa.zonePoints[z];
      const bv = sb.zonePoints[z];
      if (av !== bv) {
        out.push({
          kind: "changed",
          path: `sections.${key}.zonePoints.${z}`,
          label: `${label} zone ${z} point value ${av} → ${bv}`,
          from: av,
          to: bv,
        });
      }
    }
  } else if (sa.model === "on_length" && sb.model === "on_length") {
    diffArray(
      `sections.${key}.ladder_m`,
      `${label} ladder`,
      sa.ladder_m,
      sb.ladder_m,
      out,
    );
    diffNumber(
      `sections.${key}.pointsPerOnLength`,
      `${label} points per on-length`,
      sa.pointsPerOnLength,
      sb.pointsPerOnLength,
      out,
    );
  }
}

function diffNumber(
  path: string,
  label: string,
  a: number,
  b: number,
  out: RubricChange[],
) {
  if (a === b) return;
  out.push({
    kind: "changed",
    path,
    label: `${label} ${a} → ${b}`,
    from: a,
    to: b,
  });
}

function diffArray(
  path: string,
  label: string,
  a: ReadonlyArray<string | number>,
  b: ReadonlyArray<string | number>,
  out: RubricChange[],
) {
  if (a.length === b.length && a.every((v, i) => v === b[i])) return;
  out.push({
    kind: "changed",
    path,
    label: `${label} ${formatArray(a)} → ${formatArray(b)}`,
    from: formatArray(a),
    to: formatArray(b),
  });
}

function formatArray(a: ReadonlyArray<string | number>): string {
  return `[${a.join(", ")}]`;
}

/** Summary counts for the iconic "{N} changes · {n} added · {n} removed · {n} changed" line. */
export function summariseDiff(changes: ReadonlyArray<RubricChange>) {
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const c of changes) {
    if (c.kind === "added") added++;
    else if (c.kind === "removed") removed++;
    else changed++;
  }
  return { total: changes.length, added, removed, changed };
}
