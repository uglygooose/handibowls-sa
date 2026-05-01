import { SpeckleLayer } from "@/components/brand/SpeckleLayer";
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
//
// Phase 12.5 / 12.5-6 (M / `length-distribution-chart-brand-decoration`):
// brand-decoration overlay added on each bar via `<SpeckleLayer>`.
// Design source bar-chart treatment in `t20-components.jsx:318-336`
// has only a subtle white-to-transparent gradient (already shipped);
// the audit drift entry called out the bars feeling undecorated next
// to surrounding speckled brand surfaces. Speckle density is "low"
// + opacity 0.18 — subtle enough not to fight the percentage cap
// reading, distinct enough to read as a brand-textured surface.
// Per-bar seed by distance so each column has a stable but unique
// pattern (no shared-seed identicalness across bars). Both admin
// `/manage/t20/[id]` and player `/t20/[assessmentId]` consume the
// same primitive — decoration lands on both surfaces simultaneously.

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
              className="relative w-full overflow-hidden rounded-t-[4px] bg-primary-500"
              style={{ height: h }}
            >
              {/* Brand decoration — speckle layer sits below the
                  white-to-transparent gradient so the lit-from-above
                  effect still reads. Per-bar seed keeps the pattern
                  unique per column. */}
              <div
                aria-hidden="true"
                data-slot="length-distribution-bar-speckle"
                className="absolute inset-0 z-0"
              >
                <SpeckleLayer
                  seed={`length-bar-${d.distance}`}
                  density="low"
                  opacity={0.18}
                />
              </div>
              <div
                aria-hidden="true"
                className="absolute inset-0 z-[1] bg-gradient-to-b from-white/20 to-transparent"
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
