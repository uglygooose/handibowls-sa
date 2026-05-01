import { Bell, ChevronRight, Eye, Plus, Settings, User } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Bowl } from "@/components/brand/Bowl";
import { SpeckleField } from "@/components/brand/SpeckleField";
import { MyBookings } from "@/components/player/MyBookings";
import { getCurrentMemberships } from "@/lib/auth/memberships";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getAuthContext } from "@/lib/auth/role";
import { getMyBookingsForCurrentPlayer } from "@/lib/bookings/my-bookings";
import { formatRelativeZA } from "@/lib/format/relative";

import { getInboxPreview, getPlayerStats } from "./_data";

// Phase 8a — /me profile. Replaces the Phase 5 stub. Sections (per
// design source PageMe in player-pages.jsx:239):
//   1. Profile hero — speckle bg + avatar XL + name/BSA/badges
//   2. Stats strip — matches / win rate / club count
//   3. Inbox preview — top 3 notifications, link to /me/inbox
//   4. Your clubs — Bowl preset previews, primary pill
//   5. Settings list — placeholder rows (deep-links land in 8a follow-up
//      and Phase 11)

export const metadata = {
  title: "Me · HandiBowls",
};

export default async function MePage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  const [profile, memberships, stats, inbox, myBookings] = await Promise.all([
    getCurrentProfile(),
    getCurrentMemberships(),
    getPlayerStats(),
    getInboxPreview(3),
    getMyBookingsForCurrentPlayer("full"),
  ]);

  const fullName = displayName(
    profile?.first_name,
    profile?.last_name,
    profile?.display_name,
    ctx.email,
  );
  const initials = initialsOf(fullName);
  const primary = memberships.find((m) => m.is_primary) ?? memberships[0] ?? null;
  const primaryThemePreset = primary?.club_theme_preset ?? "atomic-red";
  const grading = primary?.club_grading ?? null;
  const unreadCount = inbox.filter((n) => !n.read).length;

  return (
    <div className="pb-24">
      {/* Profile hero */}
      <section className="relative isolate overflow-hidden bg-primary-500 text-[color:var(--color-on-primary)]">
        <div className="pointer-events-none absolute inset-0 z-0 opacity-90">
          <SpeckleField preset={primaryThemePreset} density={1.1} opacityScale={1.2} />
        </div>
        <div className="relative z-10 mx-auto flex max-w-3xl items-center gap-4 px-5 py-7">
          <span
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-white/95 font-display text-[22px] font-black tracking-tight text-primary-500"
          >
            {initials}
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="truncate font-display text-[28px] font-black italic leading-none tracking-tight">
              {fullName}
            </h1>
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-[color:var(--color-on-primary)]/90">
              {profile?.bsa_number ? `BSA ${profile.bsa_number}` : "BSA pending"}
              {primary && (
                <>
                  {" · "}Member {primary.club_name}
                </>
              )}
            </span>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {grading && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] ring-1 ring-inset ring-white/30">
                  {grading}
                </span>
              )}
              {profile?.dominant_hand && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] ring-1 ring-inset ring-white/30">
                  {profile.dominant_hand}
                </span>
              )}
              {profile?.gender && profile.gender !== "prefer_not" && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] ring-1 ring-inset ring-white/30">
                  {profile.gender}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-5">
        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-2">
          <StatCell value={String(stats.matches_played)} label="Matches" />
          <StatCell
            value={stats.win_rate == null ? "—" : `${stats.win_rate}%`}
            label="Win rate"
          />
          <StatCell value={String(stats.club_count)} label={stats.club_count === 1 ? "Club" : "Clubs"} />
        </div>

        {/* Inbox preview */}
        <SectionHead
          title="Inbox"
          right={
            <Link
              href="/me/inbox"
              className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-primary-500 hover:underline"
            >
              {unreadCount > 0
                ? `${unreadCount} unread`
                : inbox.length > 0
                  ? "View all"
                  : "Open"}
            </Link>
          }
        />
        {inbox.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-5 text-center text-[13px] text-ink-muted">
            No notifications yet. Match reminders, draws, and announcements
            land here.
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {inbox.map((n) => (
              <Link
                key={n.id}
                href="/me/inbox"
                className="flex items-start gap-3 rounded-xl border border-border bg-surface px-3 py-3 transition-colors hover:bg-surface-muted"
              >
                <span
                  aria-hidden="true"
                  className={
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full " +
                    (n.read
                      ? "bg-surface-muted text-ink-muted"
                      : "bg-primary-500/10 text-primary-500")
                  }
                >
                  <Bell className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="truncate text-[13px] font-bold">
                      {n.title}
                    </strong>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-subtle">
                      {formatRelativeZA(n.created_at)}
                    </span>
                  </div>
                  {n.body && (
                    <p className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-muted">
                      {n.body}
                    </p>
                  )}
                </div>
                {!n.read && (
                  <span
                    aria-hidden="true"
                    className="mt-1 size-2 shrink-0 rounded-full bg-primary-500"
                  />
                )}
              </Link>
            ))}
          </ul>
        )}

        {/* My bookings — Phase 8e-3, full variant on /me */}
        <MyBookings
          rows={myBookings}
          variant="full"
          heading="My bookings"
        />

        {/* Your clubs */}
        <SectionHead title="Your clubs" />
        <ul className="flex flex-col gap-1.5">
          {memberships.map((m) => (
            <li
              key={m.membership_id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3"
            >
              <Bowl preset={m.club_theme_preset} size={36} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-bold">
                  {m.club_name}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
                  {m.club_theme_preset.replace("-", " ")}
                </span>
              </div>
              {m.is_primary && (
                <span className="rounded-full bg-primary-500/12 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-primary-500 ring-1 ring-inset ring-primary-500/30">
                  Primary
                </span>
              )}
            </li>
          ))}
          <button
            type="button"
            disabled
            className="flex h-11 cursor-not-allowed items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-surface text-[13px] font-medium text-ink-muted opacity-70"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Join another club · invite-only
          </button>
        </ul>

        {/* Settings */}
        <SectionHead title="Settings" />
        <ul className="flex flex-col gap-1 rounded-xl border border-border bg-surface">
          <SettingRow icon={<User className="size-4" />} label="Personal details" trailing="—" />
          <SettingRow icon={<Bell className="size-4" />} label="Notifications" trailing="—" />
          <SettingRow icon={<Eye className="size-4" />} label="Wet hands default" trailing="Auto" />
          <SettingRow icon={<Settings className="size-4" />} label="Account" trailing="—" />
        </ul>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-subtle">
          More settings coming soon.
        </p>
      </div>
    </div>
  );
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-start gap-0.5 rounded-xl border border-border bg-surface px-3 py-3">
      <span className="font-display text-[28px] font-black italic leading-none tabular-nums">
        {value}
      </span>
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </span>
    </div>
  );
}

function SectionHead({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.12em] text-ink-muted">
        {title}
      </h2>
      {right}
    </div>
  );
}

function SettingRow({
  icon,
  label,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  trailing: string;
}) {
  return (
    <li className="flex h-12 items-center gap-3 border-b border-border px-3 last:border-b-0">
      <span aria-hidden="true" className="text-ink-muted">
        {icon}
      </span>
      <span className="flex-1 text-[13.5px]">{label}</span>
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-subtle">
        {trailing}
      </span>
      <ChevronRight className="size-4 text-ink-subtle" aria-hidden="true" />
    </li>
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
