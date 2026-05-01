import {
  Calendar,
  ChevronLeft,
  Copy,
  Flag,
  Lock,
  MoreHorizontal,
  Pencil,
  Printer,
  Shield,
} from "lucide-react";
import Link from "next/link";

import { AdminPageHero } from "@/components/layout/AdminPageHero";
import { EntriesGatePill } from "@/components/tournament/EntriesGatePill";
import { formatDateRangeZA } from "@/lib/format/dates";
import { FORMAT_DEFAULTS } from "@/lib/tournaments/formats";
import { cn } from "@/lib/utils";

import type { TournamentDetail } from "../_data";

const FORMAT_LABEL: Record<TournamentDetail["format"], string> = {
  singles: "Singles",
  pairs: "Pairs",
  triples: "Triples",
  fours: "Fours",
  mixed_pairs: "Mixed Pairs",
};

const STRUCTURE_LABEL: Record<TournamentDetail["structure"], string> = {
  knockout: "Knockout",
  round_robin: "Round Robin",
  sectional: "Sectional",
  drawn_social: "Drawn / Social",
};

const SCOPE_LABEL: Record<TournamentDetail["scope"], string> = {
  club: "Club",
  district: "District",
  provincial: "Provincial",
  national: "National",
};

function rulesText(t: TournamentDetail): string {
  const d = FORMAT_DEFAULTS[t.format];
  const target =
    t.shots_up_target ??
    (d.scoringModel === "shots_up" ? d.shotsTarget : null);
  const ends =
    t.ends_per_match ??
    (d.scoringModel === "fixed_ends" ? d.endsTarget : null);
  if (d.scoringModel === "shots_up") {
    return `${target ?? d.shotsTarget} shots up · ${d.bowlsPerPlayer} bowls`;
  }
  return `${ends ?? d.endsTarget} ends · ${d.bowlsPerPlayer} bowls`;
}

type Props = {
  tournament: TournamentDetail;
};

export function TournamentHero({ tournament: t }: Props) {
  const splatterPreset = t.host_club.theme_preset;
  const matchesRemaining = t.matches_total - (t.matches_total - t.matches_open - t.matches_in_progress);
  const allMatchesDone =
    t.matches_total > 0 && t.matches_open === 0 && t.matches_in_progress === 0;

  // 12.5-6: bespoke detail-page hero now consumes AdminPageHero for
  // chrome (rounded-[18px] / bg-bone / items-end / SpeckleLayer /
  // SplatterAccent constants), but keeps the breadcrumb prefix +
  // pill row meta + multi-element action stack since they're
  // detail-page-only affordances. titleSize="detail" maps to 48px
  // per page-detail.jsx:135 inline override.
  return (
    <AdminPageHero
      titleSize="detail"
      title={t.name}
      eyebrow={`${t.host_club.name} · ${STRUCTURE_LABEL[t.structure]} · ${FORMAT_LABEL[t.format]}`}
      prefix={
        <div className="flex items-center gap-2">
          <Link
            href="/manage/tournaments"
            className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[13px] font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            All tournaments
          </Link>
          <span className="text-[13px] text-ink-subtle">/ {t.name}</span>
        </div>
      }
      meta={
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-500/10 px-2.5 py-1 text-[12px] font-semibold tracking-tight text-primary-500 ring-1 ring-inset ring-primary-500/30">
            <strong>{FORMAT_LABEL[t.format]}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-[12px] font-medium text-ink-muted ring-1 ring-inset ring-border">
            <Shield className="size-3.5" aria-hidden="true" />
            {SCOPE_LABEL[t.scope]}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-[12px] font-medium text-ink-muted ring-1 ring-inset ring-border">
            <Calendar className="size-3.5" aria-hidden="true" />
            {formatDateRangeZA(t.starts_at, t.ends_at)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 font-mono text-[12px] font-medium text-ink-muted ring-1 ring-inset ring-border">
            {rulesText(t)}
          </span>
          <EntriesGatePill
            status={t.status}
            entries_close_at={t.entries_close_at}
            size="md"
          />
          <StatusPill tournament={t} />
        </div>
      }
      actions={
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2">
            <Link
              href={`/manage/tournaments/${t.id}/edit`}
              data-slot="tournament-edit-cta"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[13px] font-medium text-ink hover:bg-surface-muted"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Edit
            </Link>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[13px] font-medium text-ink hover:bg-surface-muted"
            >
              <Copy className="size-3.5" aria-hidden="true" />
              Duplicate
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[13px] font-medium text-ink hover:bg-surface-muted"
            >
              <Printer className="size-3.5" aria-hidden="true" />
              Export PDF
            </button>
            <button
              type="button"
              aria-label="More tournament actions"
              className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-surface text-ink-muted hover:bg-surface-muted hover:text-ink"
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            disabled={!allMatchesDone}
            className={cn(
              "inline-flex h-12 items-center gap-2 rounded-lg bg-primary-500 px-5 text-[14px] font-semibold text-[color:var(--color-on-primary)] shadow-sm hover:bg-primary-600",
              !allMatchesDone && "cursor-not-allowed opacity-60",
            )}
          >
            <Flag className="size-4" aria-hidden="true" />
            Complete tournament
          </button>
          <p className="max-w-[280px] text-right text-[11px] text-ink-subtle">
            {allMatchesDone
              ? "Every match verified — ready to complete."
              : matchesRemaining > 0 ? (
                <>
                  All semis &amp; final must verify before completing.{" "}
                  <strong className="text-ink">
                    {matchesRemaining} {matchesRemaining === 1 ? "match" : "matches"}
                  </strong>{" "}
                  remain open.
                </>
              ) : (
                "Generate the bracket on the Draw tab to begin scoring."
              )}
          </p>
        </div>
      }
      speckle={{ seed: `detail-hero-${t.id}`, density: "med", opacity: 0.06 }}
      splatter={{ preset: splatterPreset, variant: 0, size: "L", rotate: -12, opacity: 0.85 }}
      containerWidth="none"
    />
  );
}

// Inline pill for the tournament's overall status (in the hero pill row).
// Distinct from the list-page StatusPill because the hero shows a more
// detailed "In Progress · Round X of Y" string when matches are partway.
function StatusPill({ tournament: t }: { tournament: TournamentDetail }) {
  const status = t.status;
  if (status === "in_progress") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-info-500/10 px-2.5 py-1 text-[12px] font-semibold text-info-500 ring-1 ring-inset ring-info-500/30">
        In Progress
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-500/10 px-2.5 py-1 text-[12px] font-semibold text-success-500 ring-1 ring-inset ring-success-500/30">
        Completed
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-500/10 px-2.5 py-1 text-[12px] font-semibold text-danger-500 ring-1 ring-inset ring-danger-500/30">
        <Lock className="size-3" aria-hidden="true" /> Cancelled
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-[12px] font-semibold text-ink-muted ring-1 ring-inset ring-border">
        Draft
      </span>
    );
  }
  // status === "open"
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-info-500/10 px-2.5 py-1 text-[12px] font-semibold text-info-500 ring-1 ring-inset ring-info-500/30">
      Awaiting bracket
    </span>
  );
}
