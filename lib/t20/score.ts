// Phase 10 — Twenty 20 scoring engine.
//
// Pure functions, no Supabase, no React. The capture wizard calls
// `scoreDelivery` to compute per-bowl points for the live subtotal;
// the results view + finalize action call `aggregateAssessment` to
// roll deliveries up to section / grand totals + grade.
//
// Three section scoring models, all driven from the locked rubric
// (migration 013 v1-final-2026):
//
//   line_outcome  on_line=1pt · narrow=0.5pt · wide=0pt        (S1–2)
//   zones_8       per-zone {1:8, 2:5, 3:2, 4:4, 5:6, 6:4, 7:2, 8:5, miss:0}  (S3–5)
//   on_length     true=2pt · false=0pt                         (S6–7)
//
// Grading bands per rubric.grading (descending minPct). The mapper
// finds the highest band whose `minPct` <= percentage. Plan-locked
// bounds: Gold ≥80, Silver 65–79, Bronze 50–64, Fail <50. Edge cases:
// 79.9% → Silver, 80.0% → Gold; 49.9% → Fail, 50.0% → Bronze.

import {
  type Grade,
  type LineOutcome,
  type OnLengthOutcome,
  type Rubric,
  SECTION_KEYS,
  type SectionKey,
  type SectionModel,
  type ZoneOutcome,
} from "./rubric";

// One delivery row's outcome payload — shape varies by section model.
// `value` is the structured outcome; the section_model determines how
// to read it. Bookkeeping pattern: callers narrow on `section_model`
// before passing to scoreDelivery.
export type DeliveryOutcome =
  | { section_model: "line_outcome"; value: LineOutcome | null }
  | { section_model: "zones_8"; value: ZoneOutcome | null }
  | { section_model: "on_length"; value: OnLengthOutcome | null };

export type Delivery = {
  section: SectionKey;
  round: 1 | 2;
  /** 1..8 within a (section, round, distance) bucket. */
  delivery_index: number;
  /** Throwing distance in metres — null only when the model is hand-only with no distance bucket. */
  distance_m: number | null;
  outcome: DeliveryOutcome;
};

/** Returns the points scored for a single delivery against the rubric.
 *  Null/undefined outcomes return 0 — the caller treats unscored
 *  deliveries as 0pt for live subtotals, matching the design's
 *  capture-wizard subtotal chip behaviour. */
export function scoreDelivery(rubric: Rubric, d: Delivery): number {
  const o = d.outcome;
  if (o.value === null || o.value === undefined) return 0;
  if (o.section_model === "line_outcome") {
    const points = rubric.sections[d.section as "jacks" | "targets"].points;
    if (points && o.value in points) {
      return points[o.value as LineOutcome];
    }
    return 0;
  }
  if (o.section_model === "zones_8") {
    const sec = rubric.sections[d.section as "drive" | "control" | "trail"];
    const key = String(o.value) as keyof typeof sec.zonePoints;
    return sec.zonePoints[key] ?? 0;
  }
  // on_length
  const sec =
    rubric.sections[d.section as "speedhumps_asc" | "speedhumps_desc"];
  return o.value === true ? sec.pointsPerOnLength : 0;
}

export type SectionTotal = {
  section: SectionKey;
  model: SectionModel;
  /** Sum of points scored across all deliveries in this section (R1+R2). */
  earned: number;
  /** Maximum points possible for this section across both rounds. */
  max: number;
};

/** Compute every section's max possible score for the given rubric.
 *  Used by the live subtotal chip + the results view's per-section bar
 *  + the assessment row's percentage calc. */
export function sectionMaxes(rubric: Rubric): Record<SectionKey, number> {
  const out = {} as Record<SectionKey, number>;
  for (const key of SECTION_KEYS) {
    const sec = rubric.sections[key];
    if (sec.model === "line_outcome") {
      // 8 deliveries × 4 distances × 2 rounds × 1pt = 64. The seeded
      // rubric reports max_per_distance=16 (8 × 2 rounds × 1pt) →
      // 16 × distances_m.length per section. Using the rubric's
      // own field keeps us in lockstep with future re-tunes.
      out[key] = sec.max_per_distance * sec.distances_m.length;
    } else if (sec.model === "zones_8") {
      // 8 deliveries × 2 hands × 2 rounds × max-zone-pt(8) = 256
      // theoretical, but in practice max is 8 deliveries × 2 hands ×
      // 2 rounds × max(zonePoints). Seed rubric: max zone pt is 8 →
      // 8 × 2 × 2 × 8 = 256. Plan locks the assessment grand max at
      // 320 across all 7 sections, so this calculation diverges from
      // plan §13's 320 cap — the cap is a UI presentation choice
      // applied at the aggregate layer (see grandMax below).
      const maxZonePt = Math.max(
        ...Object.values(sec.zonePoints).filter((v) => typeof v === "number"),
      );
      out[key] = 8 * sec.hands.length * 2 * maxZonePt;
    } else {
      // on_length: ladder length × 2 hands × 2 rounds × pointsPerOnLength
      out[key] = sec.ladder_m.length * 2 * 2 * sec.pointsPerOnLength;
    }
  }
  return out;
}

/** Plan §13 / Q7 locks the grand max at 320 — the per-section maxes
 *  computed above are theoretical (all-bowls-perfect-zone-1) but the
 *  rubric's grading bands are calibrated against the practical 320.
 *  The capture wizard renders against the section-level max from
 *  `sectionMaxes`; the results view + grade calc divides total by
 *  this grandMax. */
export function grandMax(rubric: Rubric): number {
  // The seeded rubric does not expose grandMax — it's a presentation
  // constant. Callers pass it through the aggregate result.
  void rubric;
  return 320;
}

/** Look up a grade for a given percentage against the rubric's
 *  banded grading rules. Bands are sorted by minPct DESC and the
 *  first band whose threshold the percentage clears wins.
 *
 *  Edge cases (plan-locked):
 *    79.9% → silver   80.0% → gold
 *    64.9% → bronze   65.0% → silver
 *    49.9% → fail     50.0% → bronze
 */
export function gradeFor(rubric: Rubric, percent: number): Grade {
  const sorted = [...rubric.grading].sort((a, b) => b.minPct - a.minPct);
  for (const band of sorted) {
    if (percent >= band.minPct) return band.grade;
  }
  return "fail";
}

export type AssessmentScore = {
  sectionTotals: SectionTotal[];
  earned: number;
  max: number;
  percentage: number;
  grade: Grade;
};

/** Roll up every delivery in an assessment to per-section + grand
 *  totals + grade. The capture-completion server action calls this
 *  with the freshly-loaded delivery rows; the results view loads
 *  pre-computed values from `t20_assessments.total_score / percentage
 *  / grade` (server-stored at finalize time) but can fall back to
 *  this for re-derivation. */
export function aggregateAssessment(
  rubric: Rubric,
  deliveries: Delivery[],
): AssessmentScore {
  const maxes = sectionMaxes(rubric);
  const buckets: Record<SectionKey, number> = {
    jacks: 0,
    targets: 0,
    drive: 0,
    control: 0,
    trail: 0,
    speedhumps_asc: 0,
    speedhumps_desc: 0,
  };
  for (const d of deliveries) {
    buckets[d.section] += scoreDelivery(rubric, d);
  }
  const sectionTotals: SectionTotal[] = SECTION_KEYS.map((k) => ({
    section: k,
    model: rubric.sections[k].model,
    earned: buckets[k],
    max: maxes[k],
  }));
  const earned = sectionTotals.reduce((s, t) => s + t.earned, 0);
  const max = grandMax(rubric);
  const percentage = max > 0 ? (earned / max) * 100 : 0;
  const grade = gradeFor(rubric, percentage);
  return { sectionTotals, earned, max, percentage, grade };
}
