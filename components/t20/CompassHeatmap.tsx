import { CompassPicker } from "./CompassPicker";

import type { ZoneOutcome } from "@/lib/t20/rubric";

// Phase 10 — read-only compass with intensity fills.
//
// Wraps CompassPicker in `readOnly` mode and converts a per-zone
// hit-count map into normalised intensities (0..1, divided by total
// hits). Used by the results view's zone-distribution card to show
// where a player's deliveries clustered.
//
// Counts are typically aggregated server-side from the Drive /
// Control / Trail deliveries — caller decides whether to combine
// across sections (an overall heatmap) or render per-section.

type ZoneCounts = Partial<Record<Exclude<ZoneOutcome, "miss">, number>>;

type Props = {
  /** Zone (1..8) → number of deliveries that landed in that zone. */
  counts: ZoneCounts;
  size?: number;
};

export function CompassHeatmap({ counts, size = 220 }: Props) {
  const total =
    Object.values(counts).reduce((a, b) => a + (b ?? 0), 0) || 1;
  const intensities: ZoneCounts = {};
  for (const [zone, hits] of Object.entries(counts)) {
    const z = Number(zone) as Exclude<ZoneOutcome, "miss">;
    intensities[z] = (hits ?? 0) / total;
  }
  return (
    <CompassPicker
      size={size}
      readOnly
      intensities={intensities as Record<Exclude<ZoneOutcome, "miss">, number>}
      hand={null}
    />
  );
}
