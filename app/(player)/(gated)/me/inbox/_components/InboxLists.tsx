"use client";

import {
  Bell,
  Calendar,
  Mail,
  Megaphone,
  Target,
  Trophy,
} from "lucide-react";
import { useState, useTransition } from "react";

import {
  markMessageRecipientRead,
  markNotificationRead,
} from "@/lib/notifications/actions";
import { formatRelativeZA } from "@/lib/format/relative";
import { cn } from "@/lib/utils";

import type { InboxMessage, InboxNotification } from "../_data";

// Phase 11 / 11-5c — inbox tap-to-mark-read island.
//
// Closes the TODO from /me/inbox/_data.ts:
//
//   "skips the mutation until the realtime subscription lands in
//    8d, so unread state currently persists across visits"
//
// Both the notifications stream and the messages stream support
// tap-to-mark-read with optimistic UI:
//
//   notification row → markNotificationRead(notification.id)
//   message row      → markMessageRecipientRead(recipient.id)
//
// On error, we roll back the optimistic flip and restore the
// original unread chrome. RLS does the authorization at the DB
// (notifications_self_update + message_recipients_self_update),
// so the action layer is a thin wrapper.
//
// useTransition keeps the click feeling instant — the UI updates
// synchronously in startTransition's pending phase while the
// server action runs in the background.

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
  broadcast: Megaphone,
  announcement: Megaphone,
  megaphone: Megaphone,
};

export function NotificationsList({
  rows,
}: {
  rows: InboxNotification[];
}) {
  const [items, setItems] = useState<InboxNotification[]>(rows);
  const [, startTransition] = useTransition();

  function handleTap(id: string) {
    const target = items.find((n) => n.id === id);
    if (!target || target.read) return;

    // Optimistic flip.
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );

    startTransition(async () => {
      const result = await markNotificationRead(id);
      if (!result.ok) {
        // Roll back.
        setItems((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: false } : n)),
        );
      }
    });
  }

  if (items.length === 0) {
    return (
      <div
        data-slot="inbox-notifications-empty"
        className="rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-[13px] text-ink-muted"
      >
        No notifications yet. Match reminders, draws, Twenty 20 prompts,
        and booking confirmations land here.
      </div>
    );
  }
  return (
    <ul
      data-slot="inbox-notifications-list"
      className="flex flex-col gap-1.5"
    >
      {items.map((n) => {
        const Icon = NOTIFICATION_ICON[n.kind] ?? Bell;
        return (
          <li
            key={n.id}
            data-slot="inbox-notification-row"
            data-id={n.id}
            data-unread={!n.read}
            className={cn(
              "transition-colors",
              n.read
                ? "rounded-xl border border-border bg-surface"
                : "rounded-xl border border-primary-500/30 bg-surface ring-1 ring-inset ring-primary-500/10",
            )}
          >
            <button
              type="button"
              onClick={() => handleTap(n.id)}
              disabled={n.read}
              data-slot="inbox-notification-tap"
              className={cn(
                "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                n.read
                  ? "cursor-default"
                  : "cursor-pointer hover:bg-primary-500/8",
                "disabled:cursor-default",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
                  n.read
                    ? "bg-surface-muted text-ink-muted"
                    : "bg-primary-500/12 text-ink",
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <strong className="truncate text-[13.5px] font-bold leading-tight">
                    {n.title}
                  </strong>
                  <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-subtle">
                    {formatRelativeZA(n.created_at)}
                  </span>
                </span>
                {n.body && (
                  <span className="mt-1 block text-[12.5px] leading-snug text-ink-muted">
                    {n.body}
                  </span>
                )}
              </span>
              {!n.read && (
                <span
                  aria-hidden="true"
                  data-slot="inbox-notification-unread-dot"
                  className="mt-1 size-2 shrink-0 rounded-full bg-primary-500"
                />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function MessagesList({ rows }: { rows: InboxMessage[] }) {
  const [items, setItems] = useState<InboxMessage[]>(rows);
  const [, startTransition] = useTransition();

  function handleTap(recipientId: string) {
    const target = items.find((m) => m.id === recipientId);
    if (!target || target.in_app_status === "read") return;

    setItems((prev) =>
      prev.map((m) =>
        m.id === recipientId ? { ...m, in_app_status: "read" } : m,
      ),
    );

    startTransition(async () => {
      const result = await markMessageRecipientRead(recipientId);
      if (!result.ok) {
        setItems((prev) =>
          prev.map((m) =>
            m.id === recipientId ? { ...m, in_app_status: "unread" } : m,
          ),
        );
      }
    });
  }

  if (items.length === 0) {
    return (
      <div
        data-slot="inbox-messages-empty"
        className="rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-[13px] text-ink-muted"
      >
        No messages yet. Club admins post announcements and tournament
        updates here.
      </div>
    );
  }
  return (
    <ul data-slot="inbox-messages-list" className="flex flex-col gap-1.5">
      {items.map((m) => (
        <li
          key={m.id}
          data-slot="inbox-message-row"
          data-id={m.id}
          data-unread={m.in_app_status === "unread"}
          className={cn(
            m.in_app_status === "unread"
              ? "rounded-xl border border-primary-500/30 bg-surface ring-1 ring-inset ring-primary-500/10"
              : "rounded-xl border border-border bg-surface",
          )}
        >
          <button
            type="button"
            onClick={() => handleTap(m.id)}
            disabled={m.in_app_status === "read"}
            data-slot="inbox-message-tap"
            className={cn(
              "flex w-full flex-col gap-1.5 rounded-xl px-3 py-3 text-left transition-colors",
              m.in_app_status === "unread"
                ? "cursor-pointer hover:bg-primary-500/8"
                : "cursor-default",
              "disabled:cursor-default",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                {m.from_club}
              </span>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-subtle">
                {formatRelativeZA(m.sent_at)}
              </span>
            </span>
            <strong className="text-[13.5px] font-bold leading-tight">
              {m.subject}
            </strong>
            <span className="text-[12.5px] leading-snug text-ink-muted">
              {m.preview}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="rounded-full bg-surface-muted px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted ring-1 ring-inset ring-border">
                {m.channel === "email"
                  ? "Email"
                  : m.channel === "both"
                    ? "Email · in-app"
                    : "In-app"}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
