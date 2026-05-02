"use client";

import { Bell, Calendar, Mail, Megaphone, Target, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotificationsRealtime } from "@/lib/notifications/use-realtime";
import type { RecentNotification } from "@/lib/notifications/types";
import { formatRelativeZA } from "@/lib/format/relative";
import { cn } from "@/lib/utils";

// Phase 11 / 11-5b — top-bar realtime bell.
// Phase 12 / 12-3 — role-branched relatedHref + Inbox/Sent footer link.
//
// Pure-controlled-by-hook island. Server-side layout fetches the
// initial unread count + recent[5] via getInitialNotifications and
// passes them as props; the hook subscribes to live INSERT/UPDATE
// events and exposes typed state.
//
// Click → dropdown showing the latest 5 notifications with title,
// short body, relative timestamp, unread dot. Tap a row → optimistic
// mark-read + navigate to related entity (role-aware); "View all"
// link hops to the role's canonical inbox surface.
//
// Visual treatment matches the existing top-bar primitives — Lucide
// Bell icon, primary-tinted badge for unread > 0, dropdown panel
// styled like /manage/messages list rows. No flourishes — admin
// surface, density wins.

export type BellRole = "player" | "club_admin";

type Props = {
  /** Authenticated user's profile id. The bell renders nothing when
   *  null (e.g. unauth surfaces somehow reaching this slot). */
  profileId: string | null;
  /** Caller's role — drives where notification clicks land. Player
   *  notifications route to player surfaces; admin to /manage/* surfaces.
   *  super_admin currently doesn't mount the bell (deferred to post-v1
   *  per DRIFT_LOG entry "Super-admin notifications bell missing"). */
  role: BellRole;
  /** SSR-fetched unread count for paint-stable initial state. */
  initialUnreadCount: number;
  /** SSR-fetched recent 5 notifications. */
  initialRecent: RecentNotification[];
  /** Visual variant matching the parent TopBar's light/dark scheme. */
  variant?: "light" | "dark";
};

const KIND_ICON: Record<string, typeof Bell> = {
  match: Trophy,
  match_reminder: Trophy,
  trophy: Trophy,
  booking: Calendar,
  calendar: Calendar,
  t20: Target,
  target: Target,
  message: Mail,
  mail: Mail,
  broadcast: Megaphone,
  announcement: Megaphone,
  megaphone: Megaphone,
};

export function NotificationsBell({
  profileId,
  role,
  initialUnreadCount,
  initialRecent,
  variant = "light",
}: Props) {
  const router = useRouter();
  const { unreadCount, recent, markAsRead } = useNotificationsRealtime({
    profileId,
    initialUnreadCount,
    initialRecent,
  });

  // Phase 13 / 13-1 / commit 8a — was a manual `role="dialog"` div with
  // useEffect-driven outside-click + ESC handlers and a wrapperRef. Replaced
  // with shadcn Popover (Radix Popover under the hood). Radix wires
  // aria-haspopup + aria-expanded + Escape + outside-click + focus return
  // to trigger; we drop the manual ref + 20-line useEffect.
  //
  // Popover (NOT Dialog) is the right primitive: this dropdown isn't modal —
  // it doesn't block background interaction, doesn't scroll-lock, doesn't
  // need a scrim. Dialog's aria-modal would be a UX regression.
  const [open, setOpen] = useState(false);

  if (!profileId) return null;

  const isDark = variant === "dark";
  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  function relatedHref(n: RecentNotification): string {
    return resolveRelatedHref(role, n);
  }

  function handleRowClick(n: RecentNotification) {
    void markAsRead(n.id);
    setOpen(false);
    router.push(relatedHref(n));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            unreadCount > 0
              ? `Notifications (${unreadCount} unread)`
              : "Notifications"
          }
          data-slot="bell-button"
          data-unread-count={unreadCount}
          className={cn(
            "relative inline-flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors",
            isDark
              ? "text-ink-inverse hover:bg-white/10"
              : "text-ink hover:bg-surface-muted",
          )}
        >
          <Bell className="size-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              data-slot="bell-badge"
              data-count={unreadCount}
              className={cn(
                "absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[9px] font-bold leading-none",
                "bg-primary-500 text-on-primary",
              )}
            >
              {badgeLabel}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        data-slot="bell-dropdown"
        aria-label="Recent notifications"
        className={cn(
          "w-[320px] overflow-hidden p-0 sm:w-[360px]",
        )}
      >
          <header
            data-slot="bell-dropdown-header"
            className="flex items-center justify-between border-b border-border bg-surface-muted px-4 py-2.5"
          >
            <span className="font-display text-[13px] font-bold tracking-tight text-ink">
              Notifications
            </span>
            {unreadCount > 0 && (
              <span
                data-slot="bell-dropdown-unread"
                className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-accent-ink"
              >
                {unreadCount} unread
              </span>
            )}
          </header>

          {recent.length === 0 ? (
            <div
              data-slot="bell-empty"
              className="px-4 py-6 text-center text-[12.5px] text-ink-muted"
            >
              No notifications yet. Match reminders, broadcasts, and
              booking confirmations land here.
            </div>
          ) : (
            <ul
              data-slot="bell-rows"
              className="max-h-[360px] divide-y divide-border overflow-y-auto"
            >
              {recent.map((n) => {
                const Icon = KIND_ICON[n.kind] ?? Bell;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleRowClick(n)}
                      data-slot="bell-row"
                      data-notification-id={n.id}
                      data-unread={!n.read}
                      className={cn(
                        "flex w-full cursor-pointer items-start gap-3 px-3.5 py-3 text-left transition-colors",
                        n.read ? "hover:bg-surface-muted" : "bg-primary-500/4 hover:bg-primary-500/8",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                          n.read
                            ? "bg-surface-muted text-ink-muted"
                            : "bg-primary-500/12 text-accent-ink",
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <strong className="truncate text-[13px] font-bold leading-tight text-ink">
                            {n.title}
                          </strong>
                          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-subtle">
                            {formatRelativeZA(n.created_at)}
                          </span>
                        </span>
                        {n.body && (
                          <span className="mt-0.5 block truncate text-[11.5px] text-ink-muted">
                            {n.body}
                          </span>
                        )}
                      </span>
                      {!n.read && (
                        <span
                          aria-hidden="true"
                          data-slot="bell-row-unread-dot"
                          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary-500"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <footer
            data-slot="bell-dropdown-footer"
            className="border-t border-border bg-surface-muted px-4 py-2.5"
          >
            <Link
              href={viewAllHref(role)}
              onClick={() => setOpen(false)}
              data-slot="bell-view-all"
              className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink hover:text-accent-ink"
            >
              View all →
            </Link>
          </footer>
      </PopoverContent>
    </Popover>
  );
}

// ---- pure role-branching helpers ----------------------------------
//
// Exported for unit coverage. Both functions are pure: same role +
// same notification → same href, no Date / fetch / state.
//
// Routing matrix (12-3):
//
//   role=player + related_kind='message'           → /me/inbox?tab=messages
//   role=player + related_kind='booking'           → /book              (rink reservations)
//   role=player + related_kind='t20_assessment'    → /t20               (NEW — migration 040)
//   role=player + related_kind='match'             → /tournaments
//   role=player + related_kind='tournament'        → /tournaments/{id}
//   role=player + no related                       → /me/inbox
//
//   role=club_admin + related_kind='message'       → /manage/messages?tab=inbox#message-{id}
//   role=club_admin + related_kind='booking'       → /manage/overview   (Bookings tab)
//   role=club_admin + related_kind='t20_assessment'→ /manage/overview
//   role=club_admin + related_kind='tournament'    → /manage/tournaments/{id}
//   role=club_admin + related_kind='match'         → /manage/tournaments
//   role=club_admin + no related                   → /manage/messages?tab=inbox

export function resolveRelatedHref(role: BellRole, n: RecentNotification): string {
  const rk = n.related_kind ?? null;
  const rid = n.related_id ?? null;

  if (role === "player") {
    if (!rk) return "/me/inbox";
    if (rk === "message") return "/me/inbox?tab=messages";
    if (rk === "booking") return "/book";
    if (rk === "t20_assessment") return "/t20";
    if (rk === "match") return "/tournaments";
    if (rk === "tournament" && rid) return `/tournaments/${rid}`;
    return "/me/inbox";
  }
  // role === "club_admin"
  if (!rk) return "/manage/messages?tab=inbox";
  if (rk === "message") {
    return rid
      ? `/manage/messages?tab=inbox#message-${rid}`
      : "/manage/messages?tab=inbox";
  }
  if (rk === "booking" || rk === "t20_assessment") return "/manage/overview";
  if (rk === "tournament" && rid) return `/manage/tournaments/${rid}`;
  if (rk === "match") return "/manage/tournaments";
  return "/manage/messages?tab=inbox";
}

export function viewAllHref(role: BellRole): string {
  return role === "player" ? "/me/inbox" : "/manage/messages?tab=inbox";
}
