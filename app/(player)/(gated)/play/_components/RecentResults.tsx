import { formatDateZA } from "@/lib/format/dates";

import type { PlayerRecentResult } from "../_data";

// Phase 8a — recent-results horizontal strip. Mirrors player-core.jsx
// PagePlay's results-strip block. Win/Loss/Peel pill colour coded.
// Uses the canonical date helper from Phase 7b — Africa/Johannesburg.

type Props = {
  results: PlayerRecentResult[];
};

const OUTCOME_LABEL: Record<PlayerRecentResult["outcome"], string> = {
  W: "Win",
  L: "Loss",
  P: "Peel",
};

const OUTCOME_TONE: Record<PlayerRecentResult["outcome"], string> = {
  W: "bg-success-500/12 text-success-500 ring-success-500/30",
  L: "bg-danger-500/12 text-danger-500 ring-danger-500/30",
  P: "bg-info-500/12 text-info-500 ring-info-500/30",
};

export function RecentResults({ results }: Props) {
  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center">
        <p className="text-[13px] text-ink-muted">
          No completed matches yet. Your results land here once the first one
          finishes.
        </p>
      </div>
    );
  }

  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <ul className="flex gap-2 pb-2">
        {results.map((r) => (
          <li
            key={r.match_id}
            className="flex min-w-[180px] flex-col gap-1.5 rounded-xl border border-border bg-surface p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[13px] font-bold text-ink">
                vs {r.opponent_name}
              </span>
              <span
                className={
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ring-1 ring-inset " +
                  OUTCOME_TONE[r.outcome]
                }
              >
                {OUTCOME_LABEL[r.outcome]}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-ink-muted">
              {r.match_no != null && (
                <span className="uppercase tracking-[0.08em]">M{r.match_no}</span>
              )}
              <span className="font-extrabold tabular-nums text-ink">
                {r.player_shots}–{r.opponent_shots}
              </span>
              <span>{formatDateZA(r.finished_at)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
