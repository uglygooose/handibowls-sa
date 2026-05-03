import { ArrowRight, Bell } from "lucide-react";
import Link from "next/link";

import { Bowl } from "@/components/brand/Bowl";
import { PlayerHero } from "@/components/layout/PlayerHero";
import { PlayerSectionHead } from "@/components/layout/PlayerSectionHead";
import { StatCell } from "@/components/player/StatCell";
import { getCurrentHostClub } from "@/lib/auth/memberships";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getAuthContext } from "@/lib/auth/role";

import { getCurrentPlayerT20Profile } from "@/app/(player)/(gated)/t20/_data";

import {
  getPlayHomeStats,
  getRecentResultsForCurrentPlayer,
  getUnreadNotificationCount,
} from "./_data";
import { QuickActions } from "./_components/QuickActions";
import { RecentResults } from "./_components/RecentResults";

// Phase 8a → 13-4.5 — player home /play. Server Component composes:
//   • Player identity hero (PlayerHero) + 3-cell stats grid
//   • Notification banner (when unread > 0)
//   • Quick actions row
//   • Recent results horizontal strip
//   • Primary club card
//
// 13-4.5 IA tweak: HeroNextMatch moved to /tournaments (the bottom
// nav's Play tab); /play is now the always-useful welcome surface
// regardless of whether the player has an active match.

export const metadata = {
  title: "Home · HandiBowls",
};

export default async function PlayHome() {
  const ctx = await getAuthContext();
  const [profile, hostClub, stats, recentResults, unreadCount, t20Profile] =
    await Promise.all([
      getCurrentProfile(),
      getCurrentHostClub(),
      getPlayHomeStats(),
      getRecentResultsForCurrentPlayer(5),
      getUnreadNotificationCount(),
      getCurrentPlayerT20Profile(),
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

  const fullName = displayName(
    profile?.first_name,
    profile?.last_name,
    profile?.display_name,
    ctx?.email ?? null,
  );
  const initials = initialsOf(fullName);
  const primaryThemePreset = hostClub?.club_theme_preset ?? "atomic-red";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-4 pb-24">
      {/* Identity hero — same chassis as /me with /play-context stats below. */}
      <PlayerHero
        titleSize="identity"
        title={fullName}
        leading={
          <span
            aria-hidden="true"
            data-slot="play-hero-avatar"
            className="flex size-[84px] items-center justify-center rounded-full border-[3px] border-[color:var(--color-on-primary)] bg-black/25 font-display text-[36px] font-black leading-none tracking-tight"
          >
            {initials}
          </span>
        }
        meta={
          hostClub && (
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--color-on-primary)]/90">
              Member {hostClub.club_name}
            </span>
          )
        }
        speckle={{
          preset: primaryThemePreset,
          seedKey: "play-home-hero",
          intensity: "medium",
          borderRadius: 0,
        }}
        splatter={{
          preset: primaryThemePreset,
          variant: 1,
          size: "S",
          right: -50,
          bottom: -60,
          opacity: 0.5,
        }}
      />

      {/* /play stats: active matches, upcoming bookings, tournaments
          entered. Same StatCell chassis as /me but with on-your-plate-
          today metrics rather than lifetime-summary. */}
      <div className="grid grid-cols-3 gap-2">
        <StatCell value={String(stats.active_matches)} label="Active matches" />
        <StatCell
          value={String(stats.upcoming_bookings)}
          label={stats.upcoming_bookings === 1 ? "Booking" : "Bookings"}
        />
        <StatCell
          value={String(stats.tournaments_entered)}
          label="Entered"
        />
      </div>

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
            <strong className="font-extrabold">{unreadCount} unread</strong>{" "}
            {unreadCount === 1 ? "notification" : "notifications"}
          </span>
          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
        </Link>
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

function displayName(
  first: string | null | undefined,
  last: string | null | undefined,
  display: string | null | undefined,
  email: string | null,
): string {
  if (display) return display;
  const composed = [first, last].filter(Boolean).join(" ").trim();
  return composed || email || "Player";
}

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
