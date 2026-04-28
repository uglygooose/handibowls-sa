"use client";

import Link from "next/link";
import { Calendar, User, Users } from "lucide-react";

import { EntriesGatePill } from "@/components/tournament/EntriesGatePill";
import { SpeckleLayer } from "@/components/brand/SpeckleLayer";
import { formatDateZA } from "@/lib/format/dates";
import { FORMAT_DEFAULTS } from "@/lib/tournaments/formats";
import { cn } from "@/lib/utils";

import type { TournamentFormat, TournamentListRow } from "../_data";
import { deriveDisplayState, StatusPill } from "./StatusPill";
import { ScopeBadge } from "./ScopeBadge";

const FORMAT_LABEL: Record<TournamentFormat, string> = {
  singles: "Singles",
  pairs: "Pairs",
  triples: "Triples",
  fours: "Fours",
  mixed_pairs: "Mixed Pairs",
};

const STRUCTURE_LABEL: Record<TournamentListRow["structure"], string> = {
  knockout: "Knockout",
  round_robin: "Round Robin",
  sectional: "Sectional",
  drawn_social: "Drawn / Social",
};

function formatRules(format: TournamentFormat): string {
  const d = FORMAT_DEFAULTS[format];
  if (d.scoringModel === "shots_up") return `${d.shotsTarget} shots up`;
  return `${d.endsTarget} ends`;
}

function formatId(id: string): string {
  // Show last UUID segment uppercase, prefixed with #. Matches the design's
  // small mono tag in the card header strip.
  const parts = id.split("-");
  return `#${(parts[parts.length - 1] ?? id).toUpperCase()}`;
}

type Props = {
  tournament: TournamentListRow;
  className?: string;
};

export function TournamentCard({ tournament: t, className }: Props) {
  const displayState = deriveDisplayState(t);
  const inProgress = displayState === "in_progress";
  const Icon = t.format === "mixed_pairs" || t.format === "fours" || t.format === "triples" || t.format === "pairs" ? Users : User;

  return (
    <Link
      href={`/manage/tournaments/${t.id}`}
      data-slot="tournament-card"
      className={cn(
        "group relative flex flex-col rounded-2xl border border-border bg-surface text-ink transition-all hover:-translate-y-0.5 hover:border-primary-500 hover:shadow-[0_12px_24px_-10px_rgba(0,0,0,0.18)]",
        className,
      )}
    >
      {/* Card header strip — speckle-textured. Atomic-Red ground for
          in-progress, surface-muted otherwise. Format icon + structure on
          the left, last-UUID-segment ID on the right. */}
      <div
        className={cn(
          "relative h-[38px] overflow-hidden rounded-t-2xl",
          inProgress ? "bg-primary-500" : "bg-surface-muted",
        )}
      >
        <SpeckleLayer
          seed={t.id}
          density={inProgress ? "high" : "med"}
          opacity={inProgress ? 0.18 : 0.5}
        />
        <div
          className={cn(
            "relative flex items-center justify-between px-4 py-2 font-display text-[11px] font-bold uppercase tracking-[0.18em]",
            inProgress
              ? "text-[color:var(--color-on-primary)]"
              : "text-ink-muted",
          )}
        >
          <span className="flex items-center gap-1.5">
            <Icon className="size-3.5" aria-hidden="true" />
            <span>
              {FORMAT_LABEL[t.format]} · {STRUCTURE_LABEL[t.structure]}
            </span>
          </span>
          <span className="font-mono tracking-normal">{formatId(t.id)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 px-[22px] py-[18px]">
        {/* Title + scope/date pills + status (right-aligned) */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-2xl font-black leading-[1.1] tracking-tight">
              {t.name}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <ScopeBadge scope={t.scope} />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-[12px] font-medium text-ink-muted ring-1 ring-inset ring-border">
                <Calendar className="size-3.5" aria-hidden="true" />
                {formatDateZA(t.starts_at)}
              </span>
            </div>
          </div>
          <StatusPill tournament={t} />
        </div>

        {/* Footer divider + entries / rules / gate */}
        <div className="flex items-end justify-between gap-3 border-t border-border pt-3.5">
          <div className="flex items-center gap-3">
            <div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                Entries
              </div>
              <div className="font-mono text-[18px] font-bold tabular-nums">
                {t.entries_count}
                {t.max_entries != null && (
                  <span className="text-[13px] text-ink-subtle">
                    {" "}
                    / {t.max_entries}
                  </span>
                )}
              </div>
            </div>
            <div className="border-l border-border pl-3">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                Rules
              </div>
              <div className="font-mono text-[13px] font-semibold">
                {formatRules(t.format)}
              </div>
            </div>
          </div>
          <EntriesGatePill
            status={t.status}
            entries_close_at={t.entries_close_at}
          />
        </div>
      </div>
    </Link>
  );
}
