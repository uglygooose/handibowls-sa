-- Phase 2 / Migration 013 — T20 rubric v1-final seed
-- Locked production rubric per plan §13 / Q7. Zones 1–8 = positional outcome
-- sectors (compass: 1 Front-Centre, 2 Front-Right, 3 Wide-Right, 4 Back-Right,
-- 5 Back-Centre, 6 Back-Left, 7 Wide-Left, 8 Front-Left).
-- Grading: Gold ≥80%, Silver 65–79%, Bronze 50–64%, Fail <50%. Pass ≈60%.

insert into public.t20_rubric_versions (version, rubric, is_active, activated_at)
values (
  'v1-final-2026',
  $rubric$
  {
    "version": "v1-final-2026",
    "deliveriesPerRoundPerDistance": 8,
    "rounds": 2,
    "sections": {
      "jacks": {
        "distances_m": [23, 26, 29, 32],
        "model": "line_outcome",
        "points": { "on_line": 1, "narrow": 0.5, "wide": 0 },
        "max_per_distance": 16
      },
      "targets": {
        "distances_m": [23, 26, 29, 32],
        "model": "line_outcome",
        "points": { "on_line": 1, "narrow": 0.5, "wide": 0 },
        "max_per_distance": 16
      },
      "drive":   { "distance_m": 28, "model": "zones_8", "hands": ["fore","back"], "zonePoints": { "1": 8, "2": 5, "3": 2, "4": 4, "5": 6, "6": 4, "7": 2, "8": 5, "miss": 0 } },
      "control": { "distance_m": 28, "model": "zones_8", "hands": ["fore","back"], "zonePoints": { "1": 8, "2": 5, "3": 2, "4": 4, "5": 6, "6": 4, "7": 2, "8": 5, "miss": 0 } },
      "trail":   { "distance_m": 28, "model": "zones_8", "hands": ["fore","back"], "zonePoints": { "1": 8, "2": 5, "3": 2, "4": 4, "5": 6, "6": 4, "7": 2, "8": 5, "miss": 0 } },
      "speedhumps_asc":  { "ladder_m": [23, 26, 29, 32], "model": "on_length", "pointsPerOnLength": 2 },
      "speedhumps_desc": { "ladder_m": [32, 29, 26, 23], "model": "on_length", "pointsPerOnLength": 2 }
    },
    "grading": [
      { "grade": "gold",   "minPct": 80 },
      { "grade": "silver", "minPct": 65 },
      { "grade": "bronze", "minPct": 50 },
      { "grade": "fail",   "minPct": 0 }
    ],
    "passPctTarget": 60,
    "assessor": { "minLevel": 2, "secondMarkerRecommended": true }
  }
  $rubric$::jsonb,
  true,
  now()
)
on conflict (version) do nothing;
