import { cn } from "@/lib/utils";

// Phase 10 — Twenty 20 length-distribution chart.
//
// Pure-CSS vertical bars — one column per distance with a labelled
// percentage cap on top and a metric label ("23m") below. Bar
// fills primary-500 with a top-down white-to-transparent gradient
// for the lit-from-above effect the design source uses.
//
// Bar heights are scaled so the largest data point reaches the
// full chart height — the chart is comparative, not absolute.
// Empty data renders an empty placeholder rather than a bare frame.

type Datum = {
  /** Throwing distance in metres — typically 23 / 26 / 29 / 32. */
  distance: number;
  /** Whole-number percentage (0..100). */
  pct: number;
};

type Props = {
  data: Datum[];
  /** Pixel height of the bar's vertical track. Default 110. */
  barHeight?: number;
  className?: string;
};

export function LengthDistributionChart({
  data,
  barHeight = 110,
  className,
}: Props) {
  if (data.length === 0) {
    return (
      <div
        data-slot="length-distribution-chart"
        data-empty="true"
        className={cn(
          "flex h-[148px] items-center justify-center rounded-md border border-dashed border-border text-[12px] text-ink-muted",
          className,
        )}
      >
        No length data
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.pct), 100);
  return (
    <div
      data-slot="length-distribution-chart"
      data-empty="false"
      className={cn("flex h-[148px] items-end gap-3.5 pt-3.5", className)}
    >
      {data.map((d) => {
        const h = (d.pct / max) * barHeight;
        return (
          <div
            key={d.distance}
            data-slot="length-distribution-col"
            data-distance={d.distance}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <div
              data-slot="length-distribution-pct"
              className="font-mono text-[11px] font-bold tabular-nums"
            >
              {d.pct}%
            </div>
            <div
              data-slot="length-distribution-bar"
              className="relative w-full rounded-t-[4px] bg-primary-500"
              style={{ height: h }}
            >
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"
              />
            </div>
            <div
              data-slot="length-distribution-label"
              className="font-display text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink-muted"
            >
              {d.distance}m
            </div>
          </div>
        );
      })}
    </div>
  );
}
