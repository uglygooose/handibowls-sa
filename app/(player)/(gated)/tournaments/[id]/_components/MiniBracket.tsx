import { cn } from "@/lib/utils";

import type { PlayerMatchRow, PlayerRoundGroup } from "../_data";

// Phase 8b — read-only mini bracket for the player tournament detail.
// Mirrors the design source's mini-bracket block (player-core.jsx:275).
// Each round is a column; matches within a round stack vertically.
// `you` highlight wins over the muted "dim" treatment for unrelated
// in-progress matches.
//
// This is intentionally NOT a port of the admin BracketCanvas — that
// component owns full canvas zoom/pan + connector lines + finalise
// affordances. Player view is dense + read-only and benefits from
// stripped-down columns rather than a 1:1 admin canvas reuse.

const STATUS_PILL: Record<
  PlayerMatchRow["display_status"],
  { label: string; cls: string }
> = {
  OPEN: {
    label: "Open",
    cls: "bg-surface-muted text-ink-muted ring-border",
  },
  IN_PLAY: {
    label: "In play",
    cls: "bg-warning-500/16 text-warning-700 ring-warning-500/40",
  },
  FINAL: {
    label: "Final",
    cls: "bg-success-500/12 text-success-700 ring-success-500/30",
  },
  BYE: {
    label: "Bye",
    cls: "bg-info-500/12 text-info-500 ring-info-500/30",
  },
};

type Props = {
  rounds: PlayerRoundGroup[];
};

export function MiniBracket({ rounds }: Props) {
  if (rounds.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-[15px] text-ink-muted">
        Bracket lands once the draw is generated.
      </div>
    );
  }

  return (
    <div className="-mx-5 overflow-x-auto px-5 pb-2">
      <div className="flex gap-2.5">
        {rounds.map((r) => (
          <div
            key={r.round}
            className="flex w-[180px] shrink-0 flex-col gap-1.5"
          >
            <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
              <span>{r.label}</span>
              <span>{r.matches.length}</span>
            </div>
            {r.matches.map((m) => (
              <MatchTile key={m.id} match={m} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchTile({ match: m }: { match: PlayerMatchRow }) {
  const status = STATUS_PILL[m.display_status];
  const homeWon =
    m.display_status === "FINAL" && m.home_shots > m.away_shots;
  const awayWon =
    m.display_status === "FINAL" && m.away_shots > m.home_shots;

  return (
    <div
      data-player-match={m.player_is_in}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border bg-surface p-2",
        m.player_is_in
          ? "border-primary-500 ring-2 ring-primary-500/15"
          : m.display_status === "OPEN"
            ? "border-border opacity-65"
            : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">
        <span>#{m.match_no ?? m.id.slice(0, 4)}</span>
        <span
          className={
            "inline-flex h-5 items-center rounded-full px-1.5 ring-1 ring-inset font-bold " +
            status.cls
          }
        >
          {status.label}
        </span>
      </div>
      <Slot
        name={m.home_team_name}
        score={m.home_shots}
        won={homeWon}
        showScore={m.display_status !== "OPEN" && m.display_status !== "BYE"}
      />
      <Slot
        name={m.away_team_name}
        score={m.away_shots}
        won={awayWon}
        showScore={m.display_status !== "OPEN" && m.display_status !== "BYE"}
      />
    </div>
  );
}

function Slot({
  name,
  score,
  won,
  showScore,
}: {
  name: string | null;
  score: number;
  won: boolean;
  showScore: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-[12.5px]",
        won && "bg-success-500/8 font-bold",
      )}
    >
      <span className="truncate">{name ?? "TBD"}</span>
      <span className="font-mono font-bold tabular-nums text-ink">
        {showScore ? score : "—"}
      </span>
    </div>
  );
}
