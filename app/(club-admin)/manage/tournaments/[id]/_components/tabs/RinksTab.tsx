"use client";

import { RefreshCw } from "lucide-react";
import { useMemo } from "react";

import { RinkHeatmap, type RinkRow } from "@/components/tournament/RinkHeatmap";

import type { MatchRow } from "../../_data";

type Props = {
  matches: MatchRow[];
};

export function RinksTab({ matches }: Props) {
  const { rinks, rounds, totalAssigned, fairScore, repeats } = useMemo(
    () => buildRinkSummary(matches),
    [matches],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-black tracking-tight">
            Fair Rink heatmap
          </h3>
          <p className="mt-1 text-[13px] text-ink-muted">
            {totalAssigned > 0
              ? `Even-spread allocation across ${rinks.length} ${rinks.length === 1 ? "rink" : "rinks"}; ${totalAssigned} match${totalAssigned === 1 ? "" : "es"} assigned.`
              : "No rink assignments yet — pinning happens at match scheduling."}
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Re-shuffle wires alongside the fair-rink algorithm in Phase 12"
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[13px] font-medium text-ink-muted opacity-60"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Re-shuffle allocation
        </button>
      </div>

      {/* Two-card summary row — usage bar chart + fair-rink score panel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface px-5 py-4">
          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Rink usage
            </div>
            <div className="mt-1 font-display text-[28px] font-black leading-tight">
              {totalAssigned} matches · {rinks.length}{" "}
              {rinks.length === 1 ? "rink" : "rinks"}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {rinks.length === 0 ? (
              <p className="text-[13px] text-ink-muted">
                Pinning hasn&apos;t happened yet — the bar chart populates as
                matches are scheduled.
              </p>
            ) : (
              rinks.map((r) => {
                const max = Math.max(...rinks.map((x) => x.total), 1);
                const pct = (r.total / max) * 100;
                const bgIntensity = 30 + (r.total / max) * 50;
                return (
                  <div key={r.rink} className="flex items-center gap-3">
                    <span className="w-12 font-mono text-[12px] font-bold tabular-nums">
                      {r.rink}
                    </span>
                    <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-surface-muted">
                      <div
                        className="h-full rounded-md transition-[width]"
                        style={{
                          width: `${pct}%`,
                          background: `color-mix(in srgb, var(--color-primary-500) ${bgIntensity}%, var(--color-surface-muted))`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-right font-mono text-[13px] font-bold tabular-nums">
                      {r.total}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface px-5 py-4">
          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Fair-rink score
            </div>
            <div className="mt-1 font-display text-[28px] font-black leading-tight">
              {fairScore} <span className="text-ink-muted">/ 100</span>
            </div>
          </div>
          <p className="text-[13px] text-ink-muted">
            {fairScore === 100
              ? "Perfect spread — variance across rinks is zero."
              : fairScore >= 80
                ? "Good spread; minor variance acceptable for the round count."
                : fairScore > 0
                  ? "Variance is wider than ideal — consider re-shuffling once enabled."
                  : "Score derives once matches are pinned to rinks."}
          </p>
          <div className="flex flex-col gap-1.5 text-[13px]">
            <RowStat
              label="Mean per rink"
              value={
                rinks.length
                  ? (totalAssigned / rinks.length).toFixed(1)
                  : "0"
              }
            />
            <RowStat
              label="Max per rink"
              value={String(
                rinks.length ? Math.max(...rinks.map((r) => r.total)) : 0,
              )}
            />
            <RowStat
              label="Repeats (same round)"
              value={String(repeats)}
              tone={repeats > 0 ? "warning" : "muted"}
            />
            <RowStat label="Algorithm" value="Greedy under-used bias" tone="text" />
          </div>
        </div>
      </div>

      <RinkHeatmap rounds={rounds} rinks={rinks} />
    </div>
  );
}

// -------------------- helpers --------------------

function RowStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning" | "muted" | "text";
}) {
  const toneCls =
    tone === "warning"
      ? "text-warning-700"
      : tone === "text"
        ? "text-ink"
        : "text-ink-muted";
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className={`font-mono font-semibold ${toneCls}`}>{value}</span>
    </div>
  );
}

function buildRinkSummary(matches: MatchRow[]): {
  rinks: RinkRow[];
  rounds: number[];
  totalAssigned: number;
  fairScore: number;
  repeats: number;
} {
  const rinkMap = new Map<string, RinkRow>();
  const rounds = new Set<number>();
  let totalAssigned = 0;
  let repeats = 0;

  for (const m of matches) {
    if (!m.rink || m.round == null || m.match_no == null) continue;
    rounds.add(m.round);

    let row = rinkMap.get(m.rink);
    if (!row) {
      row = { rink: m.rink, total: 0, cells: {} };
      rinkMap.set(m.rink, row);
    }
    const cell = row.cells[m.round] ?? [];
    if (cell.length > 0) repeats += 1;
    cell.push({ match_no: m.match_no });
    row.cells[m.round] = cell;
    row.total += 1;
    totalAssigned += 1;
  }

  const rinkList = Array.from(rinkMap.values()).sort((a, b) =>
    a.rink.localeCompare(b.rink),
  );
  const roundList = Array.from(rounds).sort((a, b) => a - b);

  // Fair-rink score: 100 - (variance / mean^2 * 100), clamped 0..100.
  // A perfectly even spread → variance=0 → score=100.
  let fairScore = 0;
  if (rinkList.length > 0 && totalAssigned > 0) {
    const mean = totalAssigned / rinkList.length;
    const variance =
      rinkList.reduce((acc, r) => acc + Math.pow(r.total - mean, 2), 0) /
      rinkList.length;
    if (mean > 0) {
      const normalised = Math.min(100, (variance / Math.pow(mean, 2)) * 100);
      fairScore = Math.round(Math.max(0, 100 - normalised));
    } else {
      fairScore = 100;
    }
  }

  return { rinks: rinkList, rounds: roundList, totalAssigned, fairScore, repeats };
}
