import { ArrowRight, Bell, Trophy } from "lucide-react";
import Link from "next/link";

import { Bowl } from "@/components/brand/Bowl";
import { PlayerSectionHead } from "@/components/layout/PlayerSectionHead";
import { getCurrentHostClub } from "@/lib/auth/memberships";
import { getCurrentProfile } from "@/lib/auth/profile";
import { resolveActiveTheme } from "@/lib/brand/theme-from-user";

import { getCurrentPlayerT20Profile } from "@/app/(player)/(gated)/t20/_data";

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
  const [
    profile,
    hostClub,
    nextMatch,
    recentResults,
    unreadCount,
    t20Profile,
    viewerTheme,
  ] = await Promise.all([
    getCurrentProfile(),
    getCurrentHostClub(),
    getNextMatchForCurrentPlayer(),
    getRecentResultsForCurrentPlayer(5),
    getUnreadNotificationCount(),
    getCurrentPlayerT20Profile(),
    resolveActiveTheme(),
  ]);

  // 12.5-4 amendment (Finding 1): pipe latest T20 grade + date into
  // the QuickAction caption. `t20Profile.latest` is the same row the
  // /t20 hub hero displays — same source = same content.
  const t20Latest = t20Profile.latest
    ? {
        grade: t20Profile.latest.grade,
        assessed_on: t20Profile.latest.assessed_on,
      }
    : null;

  const greeting = greetingFor(profile?.first_name ?? profile?.display_name);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-5 pb-24 pt-5">
      {/* Greeting eyebrow + h1 — visually hidden via sr-only so the
          first visible content is the notif banner + HeroNextMatch +
          section-heads (matches design source PagePlay shape per
          player-pages.jsx — no h1 in the visible chrome). h1 stays
          in the a11y tree as the page landmark for screen readers
          (12.5-6.5 Stage D / `player-h1-landmark`). */}
      <header className="sr-only">
        <span>Today</span>
        <h1>{greeting}</h1>
      </header>

      {/* Notification banner — only when there's at least one unread. */}
      {unreadCount > 0 && (
        <Link
          href="/me/inbox"
          className="flex items-center gap-3 rounded-[14px] border border-info-500/30 bg-info-500/10 px-3 py-2.5 text-ink hover:bg-info-500/15"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-info-500/15">
            <Bell className="size-3.5" aria-hidden="true" />
          </span>
          <span className="flex-1 text-[15px]">
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
          viewerTheme={viewerTheme}
          scorecardHref={`/tournaments/${nextMatch.tournament.id}/matches/${nextMatch.match_id}`}
        />
      ) : (
        <EmptyNextMatch />
      )}

      {/* Quick actions */}
      <PlayerSectionHead>Quick actions</PlayerSectionHead>
      <QuickActions counts={{ openTournaments: null, t20Latest }} />

      {/* Recent results */}
      <PlayerSectionHead
        action={
          recentResults.length > 0
            ? { label: "View all", href: "/me" }
            : undefined
        }
      >
        Recent results
      </PlayerSectionHead>
      <RecentResults results={recentResults} />

      {/* Primary club */}
      {hostClub && (
        <>
          <PlayerSectionHead>Your club</PlayerSectionHead>
          <Link
            href="/me"
            className="flex items-center gap-3 rounded-[14px] border border-border bg-surface px-3 py-3 hover:bg-surface-muted"
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
            <span className="rounded-full bg-primary-500/12 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink ring-1 ring-inset ring-primary-500/30">
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
    <div className="flex flex-col items-start gap-3 rounded-[14px] border border-dashed border-border bg-surface px-4 py-6">
      <span className="flex size-10 items-center justify-center rounded-full bg-primary-500/10 text-ink">
        <Trophy className="size-5" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-black italic tracking-tight">
          No matches scheduled.
        </h2>
        <p className="text-[15px] text-ink-muted">
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

function greetingFor(firstName: string | null | undefined): string {
  if (!firstName) return "G'day, bowler";
  return `G'day, ${firstName.split(" ")[0]}`;
}
