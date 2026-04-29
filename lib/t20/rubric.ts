// Phase 10 — Twenty 20 rubric types + Zod schema.
//
// The rubric JSON is stored on `t20_rubric_versions.rubric` (jsonb),
// versioned, with at most one row `is_active=true` enforced by a
// partial unique index (migration 007). Every assessment immutably
// references the version active at capture time via
// `t20_assessments.rubric_version_id`.
//
// The seeded `v1-final-2026` (migration 013) is the canonical shape.
// This module's Zod schema validates new uploads against that shape
// — the platform admin uploads a JSON file, we parse and persist
// only if it round-trips through `RubricSchema.safeParse`.
//
// Three section scoring models — see `lib/t20/score.ts`:
//   • line_outcome  — Sections 1–2 (Jacks, Targets); on_line/narrow/wide
//   • zones_8       — Sections 3–5 (Drive, Control, Trail); compass 1..8 + miss
//   • on_length     — Sections 6–7 (Speedhumps Asc/Desc); on/off the length

import { z } from "zod";

const lineOutcomePointsSchema = z.object({
  on_line: z.number(),
  narrow: z.number(),
  wide: z.number(),
});

const zonePointsSchema = z.object({
  "1": z.number(),
  "2": z.number(),
  "3": z.number(),
  "4": z.number(),
  "5": z.number(),
  "6": z.number(),
  "7": z.number(),
  "8": z.number(),
  miss: z.number(),
});

const lineOutcomeSectionSchema = z.object({
  distances_m: z.array(z.number()).min(1),
  model: z.literal("line_outcome"),
  points: lineOutcomePointsSchema,
  max_per_distance: z.number(),
});

const zonesSectionSchema = z.object({
  distance_m: z.number(),
  model: z.literal("zones_8"),
  hands: z.array(z.enum(["fore", "back"])).min(1),
  zonePoints: zonePointsSchema,
});

const onLengthSectionSchema = z.object({
  ladder_m: z.array(z.number()).min(1),
  model: z.literal("on_length"),
  pointsPerOnLength: z.number(),
});

const sectionSchema = z.discriminatedUnion("model", [
  lineOutcomeSectionSchema,
  zonesSectionSchema,
  onLengthSectionSchema,
]);

const sectionsSchema = z.object({
  jacks: lineOutcomeSectionSchema,
  targets: lineOutcomeSectionSchema,
  drive: zonesSectionSchema,
  control: zonesSectionSchema,
  trail: zonesSectionSchema,
  speedhumps_asc: onLengthSectionSchema,
  speedhumps_desc: onLengthSectionSchema,
});

const gradeBandSchema = z.object({
  grade: z.enum(["gold", "silver", "bronze", "fail"]),
  minPct: z.number().min(0).max(100),
});

export const RubricSchema = z.object({
  version: z.string().min(1),
  deliveriesPerRoundPerDistance: z.number().int().positive(),
  rounds: z.number().int().positive(),
  sections: sectionsSchema,
  grading: z.array(gradeBandSchema).min(1),
  passPctTarget: z.number().min(0).max(100),
  assessor: z.object({
    minLevel: z.number().int().min(1),
    secondMarkerRecommended: z.boolean(),
  }),
});

export type Rubric = z.infer<typeof RubricSchema>;
export type RubricSection = z.infer<typeof sectionSchema>;
export type SectionKey =
  | "jacks"
  | "targets"
  | "drive"
  | "control"
  | "trail"
  | "speedhumps_asc"
  | "speedhumps_desc";
export type SectionModel = "line_outcome" | "zones_8" | "on_length";
export type LineOutcome = "on_line" | "narrow" | "wide";
export type ZoneOutcome = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | "miss";
export type OnLengthOutcome = boolean;
export type Grade = "gold" | "silver" | "bronze" | "fail";

export const SECTION_KEYS: readonly SectionKey[] = [
  "jacks",
  "targets",
  "drive",
  "control",
  "trail",
  "speedhumps_asc",
  "speedhumps_desc",
] as const;

export const ZONE_IDS: readonly ZoneOutcome[] = [1, 2, 3, 4, 5, 6, 7, 8] as const;

// Compass zone metadata. Zone 1 = Front Centre at 12 o'clock, then
// clockwise: 2 FR, 3 WR, 4 BR, 5 BC, 6 BL, 7 WL, 8 FL. Used by the
// CompassPicker SVG geometry and by the results-view heatmap legend.
export const ZONE_META: Record<
  Exclude<ZoneOutcome, "miss">,
  { label: string; short: string }
> = {
  1: { label: "Front · Centre", short: "FC" },
  2: { label: "Front · Right", short: "FR" },
  3: { label: "Wide · Right", short: "WR" },
  4: { label: "Back · Right", short: "BR" },
  5: { label: "Back · Centre", short: "BC" },
  6: { label: "Back · Left", short: "BL" },
  7: { label: "Wide · Left", short: "WL" },
  8: { label: "Front · Left", short: "FL" },
};

export function modelOf(rubric: Rubric, section: SectionKey): SectionModel {
  return rubric.sections[section].model;
}

export function distancesOf(rubric: Rubric, section: SectionKey): number[] {
  const s = rubric.sections[section];
  if (s.model === "line_outcome") return [...s.distances_m];
  if (s.model === "zones_8") return [s.distance_m];
  return [...s.ladder_m];
}
