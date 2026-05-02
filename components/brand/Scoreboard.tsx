import { cn } from "@/lib/utils";

type Props = {
  home: number;
  away: number;
  homeLabel?: string;
  awayLabel?: string;
  ends?: number;
  totalEnds?: number;
  highlight?: "home" | "away" | null;
  className?: string;
};

export function Scoreboard({
  home,
  away,
  homeLabel = "Us",
  awayLabel = "Them",
  ends,
  totalEnds,
  highlight = null,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border border-border bg-surface p-4",
        className,
      )}
      data-slot="scoreboard"
    >
      <ScoreCell label={homeLabel} value={home} active={highlight === "home"} align="start" />
      <div className="flex flex-col items-center gap-1 text-ink-muted">
        <span className="font-mono text-xs tracking-wide uppercase">
          {ends != null && totalEnds != null ? `End ${ends}/${totalEnds}` : "vs"}
        </span>
        <span className="font-display text-lg leading-none font-bold">—</span>
      </div>
      <ScoreCell label={awayLabel} value={away} active={highlight === "away"} align="end" />
    </div>
  );
}

function ScoreCell({
  label,
  value,
  active,
  align,
}: {
  label: string;
  value: number;
  active: boolean;
  align: "start" | "end";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5",
        align === "end" ? "items-end text-right" : "items-start text-left",
      )}
    >
      <span className="font-display text-sm tracking-wide uppercase text-ink-muted">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-5xl leading-none font-bold tabular-nums",
          active ? "text-accent-ink" : "text-ink",
        )}
      >
        {value}
      </span>
    </div>
  );
}
