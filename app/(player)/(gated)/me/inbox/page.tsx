import {
  Bell,
  Calendar,
  ChevronLeft,
  Mail,
  Megaphone,
  Target,
  Trophy,
} from "lucide-react";
import Link from "next/link";

import { formatRelativeZA } from "@/lib/format/relative";

import {
  getMessagesForCurrentPlayer,
  getNotificationsForCurrentPlayer,
  type InboxMessage,
  type InboxNotification,
} from "./_data";
import { InboxTabs, type InboxTab } from "./_components/InboxTabs";

// Phase 8a — /me/inbox combined notifications + messages surface.
// URL state owns the active tab (`?tab=messages`). Mirrors the design
// source's PageInbox (player-pages.jsx:307).
//
// Mark-as-read mutation deferred to 8d alongside the realtime
// subscription wiring — until then unread state persists across
// visits, which matches the design's read/unread chip rendering.

export const metadata = {
  title: "Inbox · HandiBowls",
};

const NOTIFICATION_ICON: Record<string, typeof Bell> = {
  match: Trophy,
  match_reminder: Trophy,
  trophy: Trophy,
  booking: Calendar,
  calendar: Calendar,
  t20: Target,
  target: Target,
  message: Mail,
  mail: Mail,
  announcement: Megaphone,
  megaphone: Megaphone,
};

type Props = {
  searchParams: Promise<{ tab?: string | string[] }>;
};

export default async function InboxPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const active: InboxTab = tabParam === "messages" ? "messages" : "notifications";

  const [notifications, messages] = await Promise.all([
    getNotificationsForCurrentPlayer(),
    getMessagesForCurrentPlayer(),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 pb-24 pt-5">
      {/* Header — back link + h1. Matches the design's MTopBar with
          back button shape. */}
      <div className="flex items-center gap-2">
        <Link
          href="/me"
          className="inline-flex h-9 items-center gap-1 rounded-md px-1.5 text-[13px] font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Back
        </Link>
      </div>
      <h1 className="font-display text-3xl font-black italic leading-none tracking-tight">
        Inbox
      </h1>

      <InboxTabs
        active={active}
        notificationCount={notifications.length}
        messageCount={messages.length}
      />

      {active === "notifications" ? (
        <NotificationsList rows={notifications} />
      ) : (
        <MessagesList rows={messages} />
      )}
    </div>
  );
}

function NotificationsList({ rows }: { rows: InboxNotification[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-[13px] text-ink-muted">
        No notifications yet. Match reminders, draws, T20 prompts, and
        booking confirmations land here.
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((n) => {
        const Icon = NOTIFICATION_ICON[n.kind] ?? Bell;
        return (
          <li
            key={n.id}
            data-unread={!n.read}
            className={
              "flex items-start gap-3 rounded-xl border bg-surface px-3 py-3 transition-colors " +
              (n.read
                ? "border-border"
                : "border-primary-500/30 ring-1 ring-inset ring-primary-500/10")
            }
          >
            <span
              aria-hidden="true"
              className={
                "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full " +
                (n.read ? "bg-surface-muted text-ink-muted" : "bg-primary-500/12 text-primary-500")
              }
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <strong className="truncate text-[13.5px] font-bold leading-tight">
                  {n.title}
                </strong>
                <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-subtle">
                  {formatRelativeZA(n.created_at)}
                </span>
              </div>
              {n.body && (
                <p className="mt-1 text-[12.5px] leading-snug text-ink-muted">
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
          </li>
        );
      })}
    </ul>
  );
}

function MessagesList({ rows }: { rows: InboxMessage[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-[13px] text-ink-muted">
        No messages yet. Club admins post announcements and tournament
        updates here.
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((m) => (
        <li
          key={m.id}
          data-unread={m.in_app_status === "unread"}
          className={
            "flex flex-col gap-1.5 rounded-xl border bg-surface px-3 py-3 " +
            (m.in_app_status === "unread"
              ? "border-primary-500/30 ring-1 ring-inset ring-primary-500/10"
              : "border-border")
          }
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-muted">
              {m.from_club}
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-subtle">
              {formatRelativeZA(m.sent_at)}
            </span>
          </div>
          <strong className="text-[13.5px] font-bold leading-tight">
            {m.subject}
          </strong>
          <p className="text-[12.5px] leading-snug text-ink-muted">
            {m.preview}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-surface-muted px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted ring-1 ring-inset ring-border">
              {m.channel === "email"
                ? "Email"
                : m.channel === "both"
                  ? "Email · in-app"
                  : "In-app"}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
