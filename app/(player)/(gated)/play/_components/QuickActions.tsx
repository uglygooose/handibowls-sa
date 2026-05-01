import { Calendar, Target, Trophy } from "lucide-react";
import Link from "next/link";

// Phase 8a — quick actions row. 3 cards: Browse tournaments, Book a
// rink, My Twenty 20. Mirrors player-core.jsx PagePlay's qa-row block.

export type QuickActionsCounts = {
  /** Open tournaments visible to the player. Falls through to "—" when null. */
  openTournaments: number | null;
  /** Most-recent grade earned. Null when the player has not yet been assessed. */
  t20Grade: string | null;
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
        meta={counts.t20Grade ?? "Not yet assessed"}
        metaTone="info"
      />
    </div>
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
  meta: string;
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
