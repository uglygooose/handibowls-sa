import { ArrowRight, Calendar, Trophy } from "lucide-react";
import Link from "next/link";

import { SpeckleField } from "@/components/brand/SpeckleField";
import { formatDateRangeZA } from "@/lib/format/dates";

import type { PlayerTournamentRow } from "../_data";

// Phase 8b — tournament list card for /tournaments. Mirrors the design
// source's TournamentCard (player-core.jsx:194). The Available variant
// surfaces an "Enter" CTA primary; the Entered variant surfaces "View"
// outline. Both link to /tournaments/[id] for the read-only detail —
// the design's "Enter" → entry-confirmation flow lands in Phase 11
// alongside payment integration; for 8b clicking Enter takes the
// player to the detail page where the entry CTA lives (with the
// "payment coming soon" stub line).

const FORMAT_LABEL: Record<PlayerTournamentRow["format"], string> = {
  singles: "Singles",
  pairs: "Pairs",
  triples: "Triples",
  fours: "Fours",
  mixed_pairs: "Mixed Pairs",
};

const SCOPE_LABEL: Record<PlayerTournamentRow["scope"], string> = {
  club: "Club",
  district: "District",
  provincial: "Provincial",
  national: "National",
};

const STATUS_PILL: Record<
  PlayerTournamentRow["status"],
  { label: string; cls: string }
> = {
  draft: { label: "Draft", cls: "bg-surface-muted text-ink-muted ring-border" },
  open: {
    label: "Open",
    cls: "bg-success-500/12 text-success-500 ring-success-500/30",
  },
  in_progress: {
    label: "In play",
    cls: "bg-warning-500/16 text-warning-500 ring-warning-500/40",
  },
  completed: {
    label: "Completed",
    cls: "bg-info-500/12 text-info-500 ring-info-500/30",
  },
  cancelled: {
    label: "Cancelled",
    cls: "bg-danger-500/12 text-danger-500 ring-danger-500/30",
  },
};

type Props = {
  tournament: PlayerTournamentRow;
  variant: "available" | "entered";
};

export function TournamentCard({ tournament: t, variant }: Props) {
  const isAvailable = variant === "available";
  const pct =
    t.max_entries && t.max_entries > 0
      ? Math.min(100, Math.round((t.entries_count / t.max_entries) * 100))
      : 0;
  const status = STATUS_PILL[t.status];

  return (
    <Link
      href={`/tournaments/${t.id}`}
      className="relative isolate flex flex-col gap-2.5 overflow-hidden rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-muted"
    >
      {/* Speckle band — top edge accent */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-12 opacity-60">
        <SpeckleField
          preset="atomic-red"
          density={0.9}
          opacityScale={1.1}
        />
      </div>

      <div className="relative z-10 flex flex-col gap-2.5">
        {/* Title */}
        <h3 className="font-display text-[20px] font-black uppercase italic leading-none tracking-tight">
          {t.name}
        </h3>

        {/* Meta pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill icon={<Trophy className="size-3" />}>
            {FORMAT_LABEL[t.format]}
          </Pill>
          <Pill>{SCOPE_LABEL[t.scope]}</Pill>
          <Pill className={status.cls + " ring-1 ring-inset"}>
            {status.label}
          </Pill>
          {t.handicap_rule === "handicap_start" && (
            <Pill className="bg-warning-500/16 text-warning-500 ring-1 ring-inset ring-warning-500/40">
              Handicap
            </Pill>
          )}
          {t.player_has_open_match && (
            <Pill className="bg-primary-500/12 text-primary-500 ring-1 ring-inset ring-primary-500/30">
              You&apos;re in play
            </Pill>
          )}
        </div>

        {/* Date row */}
        <div className="flex items-center justify-between gap-2 font-mono text-[11.5px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-3" aria-hidden="true" />
            {formatDateRangeZA(t.starts_at, t.ends_at) || "Dates TBD"}
          </span>
        </div>

        {/* Progress */}
        {t.max_entries != null && (
          <div className="flex flex-col gap-1.5">
            <div className="h-1 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full bg-primary-500 transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-[0.04em] text-ink-muted">
              <span>
                {t.entries_count} / {t.max_entries} entered
              </span>
              <span
                className={
                  "inline-flex h-9 items-center gap-1 rounded-lg px-3 text-[12px] font-bold uppercase tracking-[0.04em] " +
                  (isAvailable
                    ? "bg-primary-500 text-[color:var(--color-on-primary)]"
                    : "border border-border bg-surface text-ink")
                }
              >
                {isAvailable ? "Enter" : "View"}
                <ArrowRight className="size-3" aria-hidden="true" />
              </span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

function Pill({
  children,
  icon,
  className,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={
        "inline-flex h-6 items-center gap-1 rounded-full px-2 font-mono text-[10px] font-bold uppercase tracking-[0.06em] " +
        (className ?? "bg-surface-muted text-ink-muted ring-1 ring-inset ring-border")
      }
    >
      {icon}
      {children}
    </span>
  );
}
