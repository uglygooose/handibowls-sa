import { Trophy } from "lucide-react";
import Link from "next/link";

import {
  getAvailableTournamentsForPlayer,
  getEnteredTournamentsForPlayer,
  type PlayerTournamentRow,
} from "./_data";
import { TournamentCard } from "./_components/TournamentCard";
import {
  TournamentsTabs,
  type AvailableEnteredTab,
} from "./_components/TournamentsTabs";

// Phase 8b — /tournaments player list. Default tab is "Entered" so a
// returning player lands on what they're already in. Filter chips
// (Club/District/National scope) are visual-only in 8b — the count of
// non-club tournaments seeded in dev is zero, so the chips are scaffold
// for when seed data grows.

export const metadata = {
  title: "Tournaments · HandiBowls",
};

type Props = {
  searchParams: Promise<{ tab?: string | string[] }>;
};

export default async function TournamentsListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const active: AvailableEnteredTab =
    tabParam === "available" ? "available" : "entered";

  const [available, entered] = await Promise.all([
    getAvailableTournamentsForPlayer(),
    getEnteredTournamentsForPlayer(),
  ]);

  const rows = active === "available" ? available : entered;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 pb-24 pt-5">
      {/* Visually hidden — bundle's PageTournaments has no h1 in the
          visible chrome (player-core.jsx PageTournaments — straight
          to tab-bar + chips-row + cards). h1 stays in the a11y tree
          for landmark navigation (12.5-6.5 Stage D). */}
      <header className="sr-only">
        <span>Tournaments</span>
        <h1>{active === "available" ? "Open entries" : "Your tournaments"}</h1>
      </header>

      <TournamentsTabs
        active={active}
        availableCount={available.length}
        enteredCount={entered.length}
      />

      {/* Filter chips (visual only — Phase 12 polish wires the scope
          filters when district/national seed data lands). */}
      <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
        <Chip active>All</Chip>
        <Chip>Club</Chip>
        <Chip>District</Chip>
        <Chip>National</Chip>
      </div>

      {rows.length === 0 ? (
        <EmptyState tab={active} />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((t) => (
            <li key={t.id}>
              <TournamentCard tournament={t} variant={active} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={
        "inline-flex h-8 shrink-0 items-center rounded-full border px-3 font-mono text-[11px] font-bold uppercase tracking-[0.06em] " +
        (active
          ? "border-ink bg-ink text-ink-inverse"
          : "border-border bg-surface text-ink-muted")
      }
    >
      {children}
    </span>
  );
}

function EmptyState({ tab }: { tab: AvailableEnteredTab }) {
  if (tab === "available") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-surface px-4 py-6">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary-500/10 text-primary-500">
          <Trophy className="size-5" aria-hidden="true" />
        </span>
        <h2 className="font-display text-xl font-black italic tracking-tight">
          No open entries.
        </h2>
        <p className="text-[15px] text-ink-muted">
          Your club doesn&apos;t have any open tournament entries right now.
          Check back soon — your club admin posts new tournaments here.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-surface px-4 py-6">
      <span className="flex size-10 items-center justify-center rounded-full bg-primary-500/10 text-primary-500">
        <Trophy className="size-5" aria-hidden="true" />
      </span>
      <h2 className="font-display text-xl font-black italic tracking-tight">
        Not entered in any tournaments yet.
      </h2>
      <p className="text-[15px] text-ink-muted">
        Browse open entries to enter your first one. Once you&apos;re in,
        match cards and bracket progress land here.
      </p>
      <Link
        href="/tournaments?tab=available"
        className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary-500 px-4 text-[13px] font-semibold text-[color:var(--color-on-primary)] hover:bg-primary-600"
      >
        Browse open entries
      </Link>
    </div>
  );
}

// re-export so `page.tsx` consumers don't need a separate import path.
export type { PlayerTournamentRow };
