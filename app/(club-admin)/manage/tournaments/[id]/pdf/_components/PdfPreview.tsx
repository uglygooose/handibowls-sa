"use client";

import dynamic from "next/dynamic";
import { ChevronLeft, Download, Printer } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { DrawSheet, type DrawSheetMatch } from "@/components/pdf/DrawSheet";
import { FinalResults, type FinalResultsRow } from "@/components/pdf/FinalResults";
import {
  RoundScoresheet,
  type RoundScoresheetMatch,
} from "@/components/pdf/RoundScoresheet";
import { formatDateRangeZA } from "@/lib/format/dates";

import type { MatchRow, TournamentDetail } from "../../_data";

// PDF download links lazy-load @react-pdf/renderer's PDFDownloadLink.
// Keeps the ~200kb renderer bundle out of the initial admin payload —
// only loads when an admin lands on a /pdf route.
const PDFDownloadLink = dynamic(
  () =>
    import("@react-pdf/renderer").then((m) => ({
      default: m.PDFDownloadLink,
    })),
  { ssr: false },
);

const PDFViewer = dynamic(
  () =>
    import("@react-pdf/renderer").then((m) => ({
      default: m.PDFViewer,
    })),
  { ssr: false },
);

type Props = {
  type: "draw" | "round" | "final";
  tournament: TournamentDetail;
  matches: MatchRow[];
};

const FORMAT_LABELS: Record<TournamentDetail["format"], string> = {
  singles: "Singles",
  pairs: "Pairs",
  triples: "Triples",
  fours: "Fours",
  mixed_pairs: "Mixed Pairs",
};

const STRUCTURE_LABELS: Record<TournamentDetail["structure"], string> = {
  knockout: "Knockout",
  round_robin: "Round Robin",
  sectional: "Sectional",
  drawn_social: "Drawn / Social",
};

const SCOPE_LABELS: Record<TournamentDetail["scope"], string> = {
  club: "Club",
  district: "District",
  provincial: "Provincial",
  national: "National",
};

export function PdfPreview({ type, tournament, matches }: Props) {
  const dateRange = formatDateRangeZA(tournament.starts_at, tournament.ends_at);
  const formatLabel = FORMAT_LABELS[tournament.format];
  const structureLabel = STRUCTURE_LABELS[tournament.structure];
  const scopeLabel = SCOPE_LABELS[tournament.scope];

  // Group matches by round for both Draw + Round templates.
  const rounds = useMemo(() => {
    const byRound = new Map<number, MatchRow[]>();
    for (const m of matches) {
      if (m.round == null) continue;
      const list = byRound.get(m.round) ?? [];
      list.push(m);
      byRound.set(m.round, list);
    }
    const sorted = Array.from(byRound.keys()).sort((a, b) => a - b);
    const total = sorted.length;
    return sorted.map((r) => ({
      round: r,
      label: roundLabel(r, total),
      matches: (byRound.get(r) ?? []).sort(
        (a, b) => (a.match_no ?? 0) - (b.match_no ?? 0),
      ),
    }));
  }, [matches]);

  const document = useMemo(() => {
    if (type === "draw") {
      return (
        <DrawSheet
          themePreset={tournament.host_club.theme_preset}
          clubName={tournament.host_club.name}
          tournamentName={tournament.name}
          formatLabel={formatLabel}
          structureLabel={structureLabel}
          scopeLabel={scopeLabel}
          dateRange={dateRange}
          entryCount={tournament.entries_count}
          seedingMethod={tournament.seeding_method}
          handicapRule={tournament.handicap_rule}
          rounds={rounds.map((r) => ({
            round: r.round,
            label: r.label,
            matches: r.matches.map<DrawSheetMatch>((m) => {
              const winnerHome =
                m.winner_team_id != null &&
                m.home_team?.id === m.winner_team_id;
              const winnerAway =
                m.winner_team_id != null &&
                m.away_team?.id === m.winner_team_id;
              return {
                match_no: m.match_no ?? 0,
                round: m.round ?? 0,
                rink: m.rink,
                homeName: m.home_team?.name ?? "TBD",
                homeScore: m.home_shots,
                homeIsWinner: winnerHome,
                awayName: m.away_team?.name ?? "TBD",
                awayScore: m.away_shots,
                awayIsWinner: winnerAway,
              };
            }),
          }))}
        />
      );
    }
    if (type === "round") {
      return (
        <RoundScoresheet
          themePreset={tournament.host_club.theme_preset}
          clubName={tournament.host_club.name}
          tournamentName={tournament.name}
          formatLabel={formatLabel}
          structureLabel={structureLabel}
          dateRange={dateRange}
          rounds={rounds.map((r) => ({
            round: r.round,
            label: r.label,
            matches: r.matches.map<RoundScoresheetMatch>((m) => ({
              match_no: m.match_no ?? 0,
              rink: m.rink,
              homeName: m.home_team?.name ?? "TBD",
              homeScore: m.home_shots,
              awayName: m.away_team?.name ?? "TBD",
              awayScore: m.away_shots,
              status: humanStatus(m.status, m.finalized_by_admin),
              isFinal: m.status === "completed" && m.finalized_by_admin,
            })),
          }))}
        />
      );
    }
    // type === "final"
    const finalMatch = rounds.length
      ? rounds[rounds.length - 1].matches.find(
          (m) => m.status === "completed" && m.finalized_by_admin,
        )
      : null;
    const champion =
      finalMatch?.winner_team_id == null
        ? null
        : finalMatch.winner_team_id === finalMatch.home_team?.id
          ? finalMatch.home_team
          : finalMatch.away_team;
    const runnerUp =
      finalMatch == null || champion == null
        ? null
        : champion.id === finalMatch.home_team?.id
          ? finalMatch.away_team
          : finalMatch.home_team;
    const podium: FinalResultsRow[] = [];
    if (champion) {
      podium.push({
        placement: "1st",
        teamName: champion.name ?? `Team ${champion.seed ?? "?"}`,
        seed: champion.seed,
      });
    }
    if (runnerUp) {
      podium.push({
        placement: "2nd",
        teamName: runnerUp.name ?? `Team ${runnerUp.seed ?? "?"}`,
        seed: runnerUp.seed,
      });
    }
    return (
      <FinalResults
        themePreset={tournament.host_club.theme_preset}
        clubName={tournament.host_club.name}
        tournamentName={tournament.name}
        formatLabel={formatLabel}
        structureLabel={structureLabel}
        dateRange={dateRange}
        championName={champion?.name ?? null}
        championSeed={champion?.seed ?? null}
        runnerUpName={runnerUp?.name ?? null}
        runnerUpSeed={runnerUp?.seed ?? null}
        podium={podium}
        finalScore={
          finalMatch
            ? { home: finalMatch.home_shots, away: finalMatch.away_shots }
            : null
        }
      />
    );
  }, [type, tournament, rounds, formatLabel, structureLabel, scopeLabel, dateRange]);

  const slug =
    type === "draw"
      ? "draw-sheet"
      : type === "round"
        ? "round-scoresheet"
        : "final-results";
  const fileName = `${tournament.name.toLowerCase().replace(/[^\w]+/g, "-")}-${slug}.pdf`;

  return (
    <div className="flex flex-col gap-4 px-8 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/manage/tournaments/${tournament.id}`}
            className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[13px] font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            Back to tournament
          </Link>
          <h1 className="mt-1 font-display text-3xl font-black italic tracking-tight">
            {pdfTitle(type)} · {tournament.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <PdfTypeChip
            active={type === "draw"}
            href={`/manage/tournaments/${tournament.id}/pdf?type=draw`}
            label="Draw"
          />
          <PdfTypeChip
            active={type === "round"}
            href={`/manage/tournaments/${tournament.id}/pdf?type=round`}
            label="Scoresheet"
          />
          <PdfTypeChip
            active={type === "final"}
            href={`/manage/tournaments/${tournament.id}/pdf?type=final`}
            label="Final results"
          />
          <PDFDownloadLink
            document={document}
            fileName={fileName}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary-500 px-4 text-[13px] font-semibold text-[color:var(--color-on-primary)] hover:bg-primary-600"
          >
            <Download className="size-3.5" aria-hidden="true" />
            Download PDF
          </PDFDownloadLink>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[13px] font-medium text-ink hover:bg-surface-muted"
          >
            <Printer className="size-3.5" aria-hidden="true" />
            Print preview
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <PDFViewer
          width="100%"
          height={900}
          showToolbar={false}
          className="border-0"
        >
          {document}
        </PDFViewer>
      </div>
    </div>
  );
}

// -------------------- helpers --------------------

function PdfTypeChip({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex h-10 items-center rounded-lg border px-3 text-[13px] font-medium transition-colors ${
        active
          ? "border-primary-500 bg-primary-100/40 text-primary-500"
          : "border-border bg-surface text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

function pdfTitle(type: "draw" | "round" | "final"): string {
  if (type === "draw") return "Draw sheet";
  if (type === "round") return "Round scoresheet";
  return "Final results";
}

function humanStatus(status: string, finalized: boolean): string {
  if (status === "walkover") return "BYE";
  if (status === "completed" && finalized) return "FINAL";
  if (status === "completed") return "Done";
  if (status === "in_progress") return "Live";
  if (status === "scheduled") return "Open";
  if (status === "cancelled") return "Cancelled";
  return status;
}

function roundLabel(round: number, total: number): string {
  if (round === total) return "Final";
  if (round === total - 1) return "Semi-finals";
  if (round === total - 2) return "Quarter-finals";
  return `Round ${round}`;
}
