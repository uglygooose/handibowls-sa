import { ArrowRight, Clock, MapPin } from "lucide-react";
import Link from "next/link";

import { SpeckleField } from "@/components/brand/SpeckleField";
import { SplatterAccent } from "@/components/brand/SplatterAccent";

import type { PlayerNextMatch } from "../_data";

// Phase 8a — hero card for /play. Mirrors the design source's
// HeroNextMatch (player-core.jsx:84) + the `.hero-card` CSS rules
// in player-styles.css:253-267:
//
//   .hero-card {
//     position: relative;
//     border-radius: 20px;
//     overflow: hidden;
//     color: var(--on-primary);
//     background: var(--primary-500);
//     margin-bottom: 16px;
//   }
//   .hero-card .splatter {
//     position: absolute; right: -40px; top: -40px;
//   }
//   .hero-card .hero-inner { padding: 18px 18px 20px; }
//
// Speckle-tinted primary surface, vs-stack with avatars + rolling
// totals, target line + rink, big "SCORE THIS MATCH" CTA. The CTA's
// destination is the scorecard surface (Phase 8c — route exists
// once 8c lands; for 8a the link targets the read-only detail page
// so the user can see the bracket).
//
// Phase 12.5 / 12.5-6.5 Stage E: aligned to bundle's `.hero-card`
// contract — radius bumped from rounded-2xl (16px) to rounded-[20px],
// splatter inset from -right-6/-top-6 (-24px) to -right-10/-top-10
// (-40px), inner padding to match `18px 18px 20px` (px-[18px]
// pt-[18px] pb-5).

type Props = {
  match: PlayerNextMatch;
  /** Fallback target while the scorecard route ships in 8c. */
  scorecardHref?: string;
};

const FORMAT_LABEL: Record<PlayerNextMatch["tournament"]["format"], string> = {
  singles: "Singles",
  pairs: "Pairs",
  triples: "Triples",
  fours: "Fours",
  mixed_pairs: "Mixed Pairs",
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function HeroNextMatch({ match, scorecardHref }: Props) {
  const playerScore = match.player_is_home ? match.home_shots : match.away_shots;
  const opponentScore = match.player_is_home
    ? match.away_shots
    : match.home_shots;
  const targetLabel =
    match.tournament.shots_up_target != null
      ? `TARGET ${match.tournament.shots_up_target}`
      : match.tournament.ends_per_match != null
        ? `OF ${match.tournament.ends_per_match} ENDS`
        : `${FORMAT_LABEL[match.tournament.format]}`;

  const detailHref = `/tournaments/${match.tournament.id}`;
  const ctaHref = scorecardHref ?? detailHref;
  const isLive = match.status === "in_progress";
  const handicapBadge =
    match.tournament.handicap_rule === "handicap_start" ? "HANDICAP" : null;

  return (
    <div
      data-slot="hero-next-match"
      className="relative isolate overflow-hidden rounded-[20px] bg-primary-500 text-[color:var(--color-on-primary)]"
    >
      <div className="pointer-events-none absolute inset-0 z-0">
        {/* 12.5-7 (audit id `speckle-field-numeric-consumer-
            reconciliation`): density={1.4} opacityScale={1.6} sit
            ABOVE the named `bold` tier (1.3 / 1.4) — locked as a
            named exception, NOT migrated. /play's HeroNextMatch is
            the iconic top-of-page hero card with a more saturated
            speckle than any other surface; snapping to bold (1.3 /
            1.4) reduces visual noise enough to dull the
            "iconic" feel. Keep numeric. */}
        <SpeckleField
          preset={match.tournament.host_club_theme}
          density={1.4}
          opacityScale={1.6}
          seedKey={`hero-next-match-${match.match_id}`}
        />
      </div>
      <div className="pointer-events-none absolute -right-10 -top-10 z-0 opacity-55">
        <SplatterAccent
          preset={match.tournament.host_club_theme}
          variant={1}
          size={150}
          rotate={20}
        />
      </div>

      <div className="relative z-10 flex flex-col gap-3 px-[18px] pt-[18px] pb-5">
        {/* Eyebrow + live pill */}
        <div className="flex items-center justify-between gap-2">
          {/* Phase 13 / 13-1 / commit 12: on-primary text/85 → no opacity.
              Same axe-serious tinted-pill class-of-bug as OfflineSyncBadge
              fix in commit 9 — opacity-modifier on top of on-primary
              reduces effective contrast below 4.5:1 on lighter primary
              tones (sunburst, white-speckle). on-primary at full opacity
              passes everywhere; visual hierarchy preserved via font-size +
              tracking + uppercase, not opacity. */}
          <div className="font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-[color:var(--color-on-primary)]">
            {match.tournament.name} · {match.round_label}
          </div>
          {isLive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink">
              <span className="size-1.5 rounded-full bg-primary-500" aria-hidden="true" />
              Now
            </span>
          )}
        </div>

        {/* VS stack */}
        <div className="flex flex-col gap-2.5 rounded-[14px] bg-black/15 p-3">
          <PlayerLine
            initials="YOU"
            name={match.player_is_home ? "Your team" : "You"}
            score={playerScore}
            tone="you"
          />
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-on-primary)]">
            — vs —
          </div>
          <PlayerLine
            initials={initialsOf(match.opponent_name)}
            name={match.opponent_name}
            score={opponentScore}
            tone="opp"
          />
        </div>

        {/* Meta row */}
        <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.06em] text-[color:var(--color-on-primary)]">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" aria-hidden="true" />
            {match.rink ?? "Rink TBD"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden="true" />
            {targetLabel}
          </span>
        </div>

        {/* Handicap line — only when the tournament rule is handicap_start. */}
        {handicapBadge && (
          <div className="rounded-md bg-black/30 px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-[color:var(--color-on-primary)]/90">
            Handicap start · scores reflect bonus shots
          </div>
        )}

        {/* CTAs */}
        <Link
          href={ctaHref}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-[14px] bg-ink px-5 text-[14px] font-extrabold uppercase tracking-[0.04em] text-ink-inverse shadow-md transition-colors hover:bg-ink/90"
        >
          {isLive ? "Score this match" : "Open match"}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <Link
          href={detailHref}
          className="inline-flex h-9 items-center justify-center text-[12px] font-medium text-[color:var(--color-on-primary)] hover:underline"
        >
          View match details
        </Link>
      </div>
    </div>
  );
}

function PlayerLine({
  initials,
  name,
  score,
  tone,
}: {
  initials: string;
  name: string;
  score: number;
  tone: "you" | "opp";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/90 font-display text-[12px] font-extrabold tracking-tight text-ink"
        >
          {initials}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[14px] font-bold leading-tight">
            {name}
          </span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--color-on-primary)]/80">
            {tone === "you" ? "You" : "Opp"}
          </span>
        </div>
      </div>
      <span className="font-display text-[36px] font-black italic leading-none tabular-nums">
        {score}
      </span>
    </div>
  );
}
