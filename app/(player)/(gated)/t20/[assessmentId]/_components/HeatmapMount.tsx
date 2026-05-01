"use client";

import dynamic from "next/dynamic";

import type { ZoneOutcome } from "@/lib/t20/rubric";

// Phase 12.5 / 12.5-4: thin Client wrapper around the lazy-loaded
// CompassHeatmap. `next/dynamic({ ssr: false })` is only allowed
// inside Client Components per Next 16 / Turbopack — this wrapper
// keeps the heatmap chunk lazy-loaded while letting the parent
// PlayerResultsView stay a Server Component.
//
// Same pattern as 12-5's DynamicSyncBadgeMount: tiny "use client"
// shell, real component lives in the deferred chunk.

const CompassHeatmap = dynamic(
  () =>
    import("@/components/t20/CompassHeatmap").then((m) => ({
      default: m.CompassHeatmap,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        className="mx-auto h-[240px] w-[240px] rounded-full bg-surface-muted"
      />
    ),
  },
);

type Props = {
  counts: Partial<Record<Exclude<ZoneOutcome, "miss">, number>>;
  size?: number;
};

export function HeatmapMount({ counts, size = 240 }: Props) {
  return <CompassHeatmap counts={counts} size={size} />;
}
