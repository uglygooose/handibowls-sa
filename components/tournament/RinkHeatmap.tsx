import { cn } from "@/lib/utils";

// Rink-utilisation heatmap. Admin-side primitive; future Phase-8
// player surface inherits read-only.
//
// Shape: rows = rinks (sorted alphabetically), columns = rounds (sorted
// numerically). Each cell renders the M## tags of the matches scheduled
// at that intersection, with a primary-tinted background that fades
// in proportion to the cell's match count vs the row max.
//
// Pure render — caller pre-aggregates from the matches table. Keeps
// the primitive amenable to both server- and client-side composition.

export type HeatmapMatchRef = {
  match_no: number;
};

export type RinkRow = {
  rink: string;
  total: number;
  cells: Record<number, HeatmapMatchRef[]>;
};

type Props = {
  rounds: number[];
  rinks: RinkRow[];
  /** Highest single-cell match count — drives the colour scale. */
  maxCellCount?: number;
  className?: string;
};

export function RinkHeatmap({ rounds, rinks, maxCellCount, className }: Props) {
  const max =
    maxCellCount ??
    rinks.reduce(
      (acc, r) =>
        Math.max(
          acc,
          ...rounds.map((round) => (r.cells[round] ?? []).length),
        ),
      1,
    );

  if (rinks.length === 0) {
    return (
      <div
        data-slot="rink-heatmap"
        className={cn(
          "rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center text-[13px] text-ink-muted",
          className,
        )}
      >
        No matches assigned to rinks yet — the heatmap activates once the
        bracket is generated and rinks are pinned.
      </div>
    );
  }

  return (
    <div
      data-slot="rink-heatmap"
      className={cn("overflow-x-auto rounded-xl border border-border bg-surface", className)}
    >
      <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-border bg-surface-muted/50">
            <th
              scope="col"
              className="sticky left-0 z-10 bg-surface-muted/50 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted"
            >
              Rink
            </th>
            {rounds.map((round) => (
              <th
                key={round}
                scope="col"
                className="px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted"
              >
                Round {round}
              </th>
            ))}
            <th
              scope="col"
              className="px-3 py-2 text-right font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted"
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rinks.map((row) => (
            <tr key={row.rink} className="border-b border-border/60 last:border-b-0">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-bone px-3 py-3 font-display text-[14px] font-bold tracking-tight"
              >
                {row.rink}
              </th>
              {rounds.map((round) => {
                const cell = row.cells[round] ?? [];
                if (cell.length === 0) {
                  return (
                    <td
                      key={round}
                      className="px-3 py-3 text-center text-[12px] text-ink-subtle"
                    >
                      —
                    </td>
                  );
                }
                const intensity = max > 0 ? Math.min(1, cell.length / max) : 0;
                const bgPct = 10 + intensity * 30;
                return (
                  <td
                    key={round}
                    className="px-3 py-3 align-top"
                    style={{
                      background: `color-mix(in srgb, var(--color-primary-500) ${bgPct}%, transparent)`,
                    }}
                  >
                    <div className="flex flex-col gap-0.5 font-mono text-[12px] font-semibold">
                      {cell.map((m) => (
                        <span key={m.match_no}>
                          M{String(m.match_no).padStart(2, "0")}
                        </span>
                      ))}
                    </div>
                  </td>
                );
              })}
              <td className="px-3 py-3 text-right font-mono text-[13px] font-bold tabular-nums">
                {row.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
