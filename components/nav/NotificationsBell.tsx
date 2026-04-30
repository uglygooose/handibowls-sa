"use client";

import { Bell, Calendar, Mail, Megaphone, Target, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useNotificationsRealtime } from "@/lib/notifications/use-realtime";
import type { RecentNotification } from "@/lib/notifications/types";
import { formatRelativeZA } from "@/lib/format/relative";
import { cn } from "@/lib/utils";

// Phase 11 / 11-5b — top-bar realtime bell.
//
// Pure-controlled-by-hook island. Server-side layout fetches the
// initial unread count + recent[5] via getInitialNotifications and
// passes them as props; the hook subscribes to live INSERT/UPDATE
// events and exposes typed state.
//
// Click → dropdown showing the latest 5 notifications with title,
// short body, relative timestamp, unread dot. Tap a row → optimistic
// mark-read + navigate to related entity; "View all" link hops to
// /me/inbox.
//
// Visual treatment matches the existing top-bar primitives — Lucide
// Bell icon, primary-tinted badge for unread > 0, dropdown panel
// styled like /manage/messages list rows. No flourishes — admin
// surface, density wins.

type Props = {
  /** Authenticated user's profile id. The bell renders nothing when
   *  null (e.g. unauth surfaces somehow reaching this slot). */
  profileId: string | null;
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

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click. Lightweight — no portal needed because
  // the dropdown lives inside the sticky top-bar's stacking context
  // (z-30 base, dropdown rises to 40 for safety).
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!profileId) return null;

  const isDark = variant === "dark";
  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  function relatedHref(n: RecentNotification): string {
    if (!n.related_kind || !n.related_id) return "/me/inbox";
    if (n.related_kind === "message") return "/me/inbox?tab=messages";
    if (n.related_kind === "booking") return "/book";
    if (n.related_kind === "match") return `/tournaments`;
    if (n.related_kind === "tournament") return `/tournaments/${n.related_id}`;
    return "/me/inbox";
  }

  function handleRowClick(n: RecentNotification) {
    void markAsRead(n.id);
    setOpen(false);
    router.push(relatedHref(n));
  }

  return (
    <div
      ref={wrapperRef}
      data-slot="notifications-bell"
      data-open={open}
      className="relative"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : "Notifications"
        }
        aria-expanded={open}
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

      {open && (
        <div
          data-slot="bell-dropdown"
          role="dialog"
          aria-label="Recent notifications"
          className={cn(
            "absolute right-0 top-[calc(100%+8px)] z-40 w-[320px] overflow-hidden rounded-xl border border-border bg-bone shadow-lg",
            "sm:w-[360px]",
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
                className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-primary-500"
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
                            : "bg-primary-500/12 text-primary-500",
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
              href="/me/inbox"
              onClick={() => setOpen(false)}
              data-slot="bell-view-all"
              className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink hover:text-primary-500"
            >
              View all →
            </Link>
          </footer>
        </div>
      )}
    </div>
  );
}
