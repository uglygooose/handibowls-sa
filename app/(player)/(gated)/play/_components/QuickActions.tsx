import { Calendar, Target, Trophy } from "lucide-react";
import Link from "next/link";

import { GradePill } from "@/components/t20/GradePill";
import { formatDateZA } from "@/lib/format/dates";
import type { Grade } from "@/lib/t20/rubric";

// Phase 8a — quick actions row. 3 cards: Browse tournaments, Book a
// rink, My Twenty 20. Mirrors player-core.jsx PagePlay's qa-row block.
//
// 12.5-4 amendment (Finding 1): the My Twenty 20 card's caption now
// reflects the player's latest submitted assessment — date + small
// grade pill — instead of the static "Not yet assessed" placeholder.
// Falls back to the placeholder when the player has zero submitted
// assessments.

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
    <span
      data-slot="t20-meta"
      data-state="assessed"
      className="inline-flex items-center gap-1.5"
    >
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] tabular-nums">
        {formatDateZA(latest.assessed_on).toUpperCase()}
      </span>
      {latest.grade && <GradePill grade={latest.grade} size="sm" />}
    </span>
  );
}

function Card({
  href,
  icon,
  label,
  meta,
  metaTone = "muted",
}: {
  href: string;
  icon: React.ReactNode;
  label: React.ReactNode;
  meta: React.ReactNode;
  metaTone?: "muted" | "info";
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[112px] flex-col items-start justify-between gap-2 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface-muted"
    >
      <span className="flex size-8 items-center justify-center rounded-md bg-primary-500/10 text-primary-500">
        {icon}
      </span>
      <span className="text-[13px] font-bold leading-tight text-ink">
        {label}
      </span>
      <span
        className={
          "font-mono text-[10px] font-bold uppercase tracking-[0.08em] " +
          (metaTone === "info" ? "text-primary-500" : "text-ink-muted")
        }
      >
        {meta}
      </span>
    </Link>
  );
}
