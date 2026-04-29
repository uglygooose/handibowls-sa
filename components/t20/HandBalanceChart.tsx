import { cn } from "@/lib/utils";

// Phase 10 — Twenty 20 hand-balance chart.
//
// Pure-CSS horizontal stacked bar — Forehand (primary-500) vs
// Backhand (ink). The design source uses divs and percentage widths;
// no recharts dependency. Sits on the results view alongside the
// zone heatmap + length distribution.
//
// Caller passes whole-number percentages (one of forehand/backhand
// can drift ±1 from a perfect 100 sum due to rounding — we don't
// auto-clamp, the values render as-given). When totals are zero
// (no zones_8 deliveries scored), the bar renders with a flat 50/50
// muted state rather than an empty container.

type Props = {
  forehand: number;
  backhand: number;
  className?: string;
};

export function HandBalanceChart({ forehand, backhand, className }: Props) {
  const isEmpty = forehand === 0 && backhand === 0;
  const f = isEmpty ? 50 : forehand;
  const b = isEmpty ? 50 : backhand;
  return (
    <div data-slot="hand-balance-chart" className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-semibold">
          Forehand{" "}
          <span className="font-mono text-ink-muted tabular-nums">{forehand}%</span>
        </span>
        <span className="font-semibold">
          Backhand{" "}
          <span className="font-mono text-ink-muted tabular-nums">{backhand}%</span>
        </span>
      </div>
      <div
        data-slot="hand-balance-bar"
        data-empty={isEmpty}
        className="flex h-7 overflow-hidden rounded-md border border-border"
      >
        <div
          data-slot="hand-balance-fore"
          className={cn(
            "flex items-center pl-2.5 font-mono text-[11px] font-bold",
            isEmpty ? "bg-surface-muted text-ink-muted" : "bg-primary-500 text-on-primary",
          )}
          style={{ width: `${f}%` }}
        >
          F
        </div>
        <div
          data-slot="hand-balance-back"
          className={cn(
            "flex items-center pl-2.5 font-mono text-[11px] font-bold",
            isEmpty ? "bg-surface-muted text-ink-muted" : "bg-ink text-ink-inverse",
          )}
          style={{ width: `${b}%` }}
        >
          B
        </div>
      </div>
    </div>
  );
}
