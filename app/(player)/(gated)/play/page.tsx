import { ArrowRight, Bell, Trophy } from "lucide-react";
import Link from "next/link";

import { Bowl } from "@/components/brand/Bowl";
import { getCurrentHostClub } from "@/lib/auth/memberships";
import { getCurrentProfile } from "@/lib/auth/profile";

import {
  getNextMatchForCurrentPlayer,
  getRecentResultsForCurrentPlayer,
  getUnreadNotificationCount,
} from "./_data";
import { HeroNextMatch } from "./_components/HeroNextMatch";
import { QuickActions } from "./_components/QuickActions";
import { RecentResults } from "./_components/RecentResults";

// Phase 8a — player home /play. Server Component composes:
//   • Notification banner (when unread > 0)
//   • Hero next match card OR empty-state when no upcoming match
//   • Quick actions row (3 cards)
//   • Recent results horizontal strip
//   • Primary club card
//
// Real data source — RLS-scoped via the SSR Supabase client. Empty
// states are explicit: a player with no entries renders the empty
// hero, no notification banner, and a "no recent results" panel.

export const metadata = {
  title: "Home · HandiBowls",
};

export default async function PlayHome() {
  const [profile, hostClub, nextMatch, recentResults, unreadCount] =
    await Promise.all([
      getCurrentProfile(),
      getCurrentHostClub(),
      getNextMatchForCurrentPlayer(),
      getRecentResultsForCurrentPlayer(5),
      getUnreadNotificationCount(),
    ]);

  const greeting = greetingFor(profile?.first_name ?? profile?.display_name);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-5 pb-24 pt-5">
      {/* Greeting eyebrow + h1 — design's MTopBar title flows here too on
          surfaces without a back button. The shared TopBar shows it as
          the route title; the inline h1 anchors the scroll context. */}
      <header className="flex flex-col gap-1">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
          Today
        </span>
        <h1 className="font-display text-3xl font-black italic leading-none tracking-tight">
          {greeting}
        </h1>
      </header>

      {/* Notification banner — only when there's at least one unread. */}
      {unreadCount > 0 && (
        <Link
          href="/me/inbox"
          className="flex items-center gap-3 rounded-xl border border-info-500/30 bg-info-500/10 px-3 py-2.5 text-info-500 hover:bg-info-500/15"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-info-500/15">
            <Bell className="size-3.5" aria-hidden="true" />
          </span>
          <span className="flex-1 text-[13px]">
            <strong className="font-extrabold">
              {unreadCount} unread
            </strong>{" "}
            {unreadCount === 1 ? "notification" : "notifications"}
            {nextMatch?.status === "in_progress" && " · match in play"}
          </span>
          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
        </Link>
      )}

      {/* Hero — next match or empty state. */}
      {nextMatch ? (
        <HeroNextMatch
          match={nextMatch}
          scorecardHref={`/tournaments/${nextMatch.tournament.id}/matches/${nextMatch.match_id}`}
        />
      ) : (
        <EmptyNextMatch />
      )}

      {/* Quick actions */}
      <SectionHead title="Quick actions" />
      <QuickActions counts={{ openTournaments: null, t20Grade: null }} />

      {/* Recent results */}
      <SectionHead
        title="Recent results"
        action={
          recentResults.length > 0
            ? { href: "/me", label: "View all" }
            : undefined
        }
      />
      <RecentResults results={recentResults} />

      {/* Primary club */}
      {hostClub && (
        <>
          <SectionHead title="Your club" />
          <Link
            href="/me"
            className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3 hover:bg-surface-muted"
          >
            <Bowl preset={hostClub.club_theme_preset} size={48} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-display text-[16px] font-extrabold tracking-tight">
                {hostClub.club_name}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
                Primary membership
              </span>
            </div>
            <span className="rounded-full bg-primary-500/12 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-primary-500 ring-1 ring-inset ring-primary-500/30">
              Primary
            </span>
          </Link>
        </>
      )}
    </div>
  );
}

function EmptyNextMatch() {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-surface px-4 py-6">
      <span className="flex size-10 items-center justify-center rounded-full bg-primary-500/10 text-primary-500">
        <Trophy className="size-5" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-black italic tracking-tight">
          No matches scheduled.
        </h2>
        <p className="text-[13px] text-ink-muted">
          You&apos;re not currently entered in any open tournaments. Browse
          available competitions to enter your first one.
        </p>
      </div>
      <Link
        href="/tournaments"
        className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary-500 px-4 text-[13px] font-semibold text-[color:var(--color-on-primary)] hover:bg-primary-600"
      >
        Browse tournaments
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

function SectionHead({
  title,
  action,
}: {
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="font-display text-[13px] font-bold uppercase tracking-[0.12em] text-ink-muted">
        {title}
      </h3>
      {action && (
        <Link
          href={action.href}
          className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-primary-500 hover:underline"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

function greetingFor(firstName: string | null | undefined): string {
  if (!firstName) return "G'day, bowler";
  return `G'day, ${firstName.split(" ")[0]}`;
}
