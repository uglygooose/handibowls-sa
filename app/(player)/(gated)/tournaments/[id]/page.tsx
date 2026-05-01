import { ArrowRight, Calendar, ChevronLeft, Circle, Trophy } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PlayerHero } from "@/components/layout/PlayerHero";
import { PlayerSectionHead } from "@/components/layout/PlayerSectionHead";
import { formatDateRangeZA } from "@/lib/format/dates";

import {
  getMatchesGroupedByRoundForPlayer,
  getPlayerOpenMatchInTournament,
  getTournamentDetailForPlayer,
  type PlayerTournamentDetail,
} from "./_data";
import { MiniBracket } from "./_components/MiniBracket";

// Phase 8b — read-only player tournament detail. Sections (per design
// source PageTournamentDetail in player-core.jsx:247):
//   1. Detail hero — speckle + splatter, eyebrow, h1, meta pills, CTA
//   2. Inline notice — current match in-play callout
//   3. Mini-bracket — round-grouped match tiles
//   4. Standings — Phase 12 follow-up (server-side aggregation needed
//      for round-robin; for knockout the bracket IS the standings)
//   5. Tournament info grid — host, district, greens, format, scoring,
//      payment placeholder
//
// Standings table (player-core.jsx:296) deferred — see DRIFT note in
// commit message. Round-robin/sectional standings need a server-side
// query that groups completed matches by team and computes W/D/L/SF/
// SA/Diff/Pts. Knockout (Demo Singles Open seed) doesn't have a
// standings table by design.

export const metadata = {
  title: "Tournament · HandiBowls",
};

const FORMAT_LABEL: Record<PlayerTournamentDetail["format"], string> = {
  singles: "Singles",
  pairs: "Pairs",
  triples: "Triples",
  fours: "Fours",
  mixed_pairs: "Mixed Pairs",
};

const STRUCTURE_LABEL: Record<PlayerTournamentDetail["structure"], string> = {
  knockout: "Knockout",
  round_robin: "Round Robin",
  sectional: "Sectional",
  drawn_social: "Drawn / Social",
};

const SCOPE_LABEL: Record<PlayerTournamentDetail["scope"], string> = {
  club: "Club",
  district: "District",
  provincial: "Provincial",
  national: "National",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PlayerTournamentDetailPage({ params }: Props) {
  const { id } = await params;
  const [tournament, rounds, openMatch] = await Promise.all([
    getTournamentDetailForPlayer(id),
    getMatchesGroupedByRoundForPlayer(id),
    getPlayerOpenMatchInTournament(id),
  ]);

  if (!tournament) notFound();

  const isLiveForPlayer = openMatch?.display_status === "IN_PLAY";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-4 pb-24">
      {/* Detail hero — bundle's `.detail-hero` shape via PlayerHero
          (rounded-[20px] contained). 12.5-6.5 Stage B restructure:
          hero now INSIDE the centered max-w-3xl wrapper (was a
          full-bleed sibling pre-12.5-6.5). Back-link breadcrumb
          stays above the hero card per design — pre-12.5-6.5 it
          was inside the hero. */}
      <Link
        href="/tournaments"
        className="inline-flex h-7 w-fit items-center gap-1 text-[12px] font-medium text-ink-muted hover:text-ink"
      >
        <ChevronLeft className="size-3.5" aria-hidden="true" />
        All tournaments
      </Link>
      <PlayerHero
        titleSize="detail"
        eyebrow={`${STRUCTURE_LABEL[tournament.structure]} · ${tournament.entries_count} entries`}
        title={tournament.name}
        meta={
          <div className="flex flex-wrap items-center gap-1.5">
            <HeroPill icon={<Trophy className="size-3" />}>
              {FORMAT_LABEL[tournament.format]}
            </HeroPill>
            <HeroPill>{SCOPE_LABEL[tournament.scope]}</HeroPill>
            <HeroPill icon={<Calendar className="size-3" />}>
              {formatDateRangeZA(tournament.starts_at, tournament.ends_at) ||
                "Dates TBD"}
            </HeroPill>
            {tournament.handicap_rule === "handicap_start" && (
              <HeroPill className="bg-black/30">Handicap</HeroPill>
            )}
          </div>
        }
        actions={
          openMatch && (
            <Link
              href={`/tournaments/${tournament.id}/matches/${openMatch.id}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-[13px] font-extrabold uppercase tracking-[0.04em] text-ink-inverse"
            >
              {isLiveForPlayer ? "Score next match" : "Open next match"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          )
        }
        speckle={{
          preset: tournament.host_club_theme,
          seedKey: `tournament-${tournament.id}`,
          intensity: "bold",
          borderRadius: 20,
        }}
        splatter={{
          preset: tournament.host_club_theme,
          variant: 2,
          size: 140,
          top: -8,
          right: -8,
          rotate: -10,
          opacity: 0.55,
        }}
      />

      <div className="flex flex-col gap-5">
        {/* Inline notice — player's current in-play match summary */}
        {openMatch && (
          <div className="flex items-center gap-3 rounded-xl border border-info-500/30 bg-info-500/10 px-3 py-2.5 text-info-500">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-info-500/15">
              <Circle className="size-3.5" aria-hidden="true" />
            </span>
            <div className="flex-1 text-[13px]">
              <strong className="block font-extrabold text-ink">
                Match #{openMatch.match_no ?? "—"}{" "}
                {openMatch.round != null && `· Round ${openMatch.round}`}
                {openMatch.player_is_home
                  ? ` · vs ${openMatch.away_team_name ?? "TBD"}`
                  : ` · vs ${openMatch.home_team_name ?? "TBD"}`}
              </strong>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-info-500">
                {openMatch.display_status === "IN_PLAY"
                  ? "In play now"
                  : "Scheduled"}
              </span>
            </div>
          </div>
        )}

        {/* Bracket */}
        <PlayerSectionHead>Bracket</PlayerSectionHead>
        <MiniBracket rounds={rounds} />

        {/* Standings — placeholder; round-robin / sectional standings ship
            when those formats are unlocked engine-wide. */}
        <PlayerSectionHead>Standings</PlayerSectionHead>
        <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-[13px] text-ink-muted">
          Standings will be available once the tournament is in progress.
          Knockout tournaments use the bracket above; round-robin and
          sectional formats will surface their tables when those formats
          unlock.
        </div>

        {/* Tournament info */}
        <PlayerSectionHead>Tournament info</PlayerSectionHead>
        <div className="grid grid-cols-2 gap-2">
          <Info label="Host" value={tournament.host_club_name} />
          <Info label="District" value={tournament.district_name ?? "—"} />
          <Info label="Greens" value={String(tournament.greens_count)} />
          <Info label="Format" value={FORMAT_LABEL[tournament.format]} />
          <Info
            label="Scoring"
            value={
              tournament.shots_up_target != null
                ? `${tournament.shots_up_target} shots up`
                : tournament.ends_per_match != null
                  ? `${tournament.ends_per_match} ends`
                  : "Format default"
            }
          />
          <Info label="Entry fee" value="See payments page" subtle />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-subtle">
          Payment collection coming soon — see{" "}
          <Link href="/payments" className="underline">
            /payments
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function HeroPill({
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
        "inline-flex h-6 items-center gap-1 rounded-full px-2 font-mono text-[10px] font-bold uppercase tracking-[0.06em] ring-1 ring-inset ring-white/30 " +
        (className ?? "bg-white/20 text-[color:var(--color-on-primary)]")
      }
    >
      {icon}
      {children}
    </span>
  );
}

function Info({
  label,
  value,
  subtle,
}: {
  label: string;
  value: string;
  subtle?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface px-3 py-2.5">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </span>
      <span className={"text-[13.5px] " + (subtle ? "text-ink-subtle" : "font-bold")}>
        {value}
      </span>
    </div>
  );
}
