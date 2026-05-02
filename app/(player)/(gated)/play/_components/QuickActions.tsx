import { Calendar, Target, Trophy } from "lucide-react";
import Link from "next/link";

import { GradePill } from "@/components/t20/GradePill";
import { formatDateZA } from "@/lib/format/dates";
import type { Grade } from "@/lib/t20/rubric";

// Phase 8a — quick actions row. 3 cards: Browse tournaments, Book a
// rink, My Twenty 20. Mirrors player-core.jsx PagePlay's qa-row block.
//
// 12.5-4 amendment (Finding 1): the My Twenty 20 card's caption now
// reflects the player's latest submitted assessment — date in the
// meta line + small grade pill in the top-right corner — instead of
// the static "Not yet assessed" placeholder. Top-right pill placement
// follows the established badge pattern on `<RecentResults>` on the
// same /play surface (`RecentResults.tsx:45` — `flex items-center
// justify-between` row with title-left + outcome-pill-right). Stage 2
// rework: pill moved from inline-meta to a card-level `topRight`
// slot so the placement matches the adjacent precedent.

export type QuickActionsT20Latest = {
  /** Grade enum value from the latest submitted assessment. May be
   *  null on legacy rows where grade was never persisted; the card
   *  then renders the date alone (no pill). */
  grade: Grade | null;
  /** ISO date string from the latest submitted assessment. */
  assessed_on: string;
};

export type QuickActionsCounts = {
  /** Open tournaments visible to the player. Falls through to "—" when null. */
  openTournaments: number | null;
  /** Latest submitted Twenty 20 assessment. Null when the player has
   *  not yet been assessed. */
  t20Latest: QuickActionsT20Latest | null;
};

type Props = {
  counts: QuickActionsCounts;
};

export function QuickActions({ counts }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Card
        href="/tournaments"
        icon={<Trophy className="size-5" aria-hidden="true" />}
        label={
          <>
            Browse
            <br />
            tournaments
          </>
        }
        meta={
          counts.openTournaments != null
            ? `${counts.openTournaments} open`
            : "—"
        }
      />
      <Card
        href="/book"
        icon={<Calendar className="size-5" aria-hidden="true" />}
        label={
          <>
            Book
            <br />
            a rink
          </>
        }
        meta="Slot picker"
      />
      <Card
        href="/t20"
        icon={<Target className="size-5" aria-hidden="true" />}
        label={
          <>
            My
            <br />
            Twenty 20
          </>
        }
        meta={<T20Meta latest={counts.t20Latest} />}
        metaTone={counts.t20Latest ? "info" : "muted"}
        topRight={
          counts.t20Latest?.grade ? (
            <GradePill grade={counts.t20Latest.grade} size="sm" />
          ) : undefined
        }
      />
    </div>
  );
}

function T20Meta({ latest }: { latest: QuickActionsT20Latest | null }) {
  if (!latest) {
    return (
      <span data-slot="t20-meta" data-state="never-assessed">
        Not yet assessed
      </span>
    );
  }
  return (
    <span data-slot="t20-meta" data-state="assessed" className="tabular-nums">
      {formatDateZA(latest.assessed_on).toUpperCase()}
    </span>
  );
}

function Card({
  href,
  icon,
  label,
  meta,
  metaTone = "muted",
  topRight,
}: {
  href: string;
  icon: React.ReactNode;
  label: React.ReactNode;
  meta: React.ReactNode;
  metaTone?: "muted" | "info";
  /** Optional top-right slot — typically a status pill. Matches the
   *  `<RecentResults>` precedent (top-row `flex justify-between`
   *  with the badge on the right). When undefined the top row
   *  collapses to icon-only and renders identically to the
   *  pre-12.5-4 layout. */
  topRight?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[112px] flex-col items-start justify-between gap-2 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface-muted"
    >
      <div
        data-slot="quick-action-top"
        className="flex w-full items-start justify-between gap-2"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-500/10 text-ink">
          {icon}
        </span>
        {topRight && (
          <span data-slot="quick-action-top-right" className="shrink-0">
            {topRight}
          </span>
        )}
      </div>
      <span className="text-[13px] font-bold leading-tight text-ink">
        {label}
      </span>
      <span
        className={
          "font-mono text-[10px] font-bold uppercase tracking-[0.08em] " +
          (metaTone === "info" ? "text-accent-ink" : "text-ink-muted")
        }
      >
        {meta}
      </span>
    </Link>
  );
}
