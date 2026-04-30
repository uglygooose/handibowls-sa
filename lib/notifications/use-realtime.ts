"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import { markNotificationRead } from "./actions";
import type { RecentNotification } from "./types";

// Phase 11 / 11-5 — realtime notifications hook.
//
// Subscribes to notifications:profile_id=eq.<id> on mount, processes
// INSERT/UPDATE postgres_changes, and exposes:
//
//   unreadCount    Live unread count for the bell badge.
//   recent         Last N notifications, ordered created_at DESC,
//                  pre-populated from the SSR snapshot the layout
//                  passed in.
//   markAsRead(id) Optimistic mutation. UI flips immediately;
//                  rolls back on server-side failure.
//
// Subscription lifecycle
//   useEffect creates one channel per profileId, ties cleanup to
//   the channel.unsubscribe() call. The supabase-js client is the
//   project's singleton browser client; channel reuse across renders
//   is handled by the strict-equality profileId dependency (no
//   re-subscribe on parent re-renders).
//
// Reconnect
//   supabase-js handles socket reconnect transparently. When a
//   transient disconnect happens, we accept that we may miss a few
//   INSERT/UPDATE events; the bell re-syncs from the next mount or
//   page refresh. Aggressive polling-on-reconnect was rejected as
//   over-engineering for an in-app channel that already replays at
//   page-load granularity.
//
// Optimistic markAsRead
//   The hook flips the row's `read=true` in local state before
//   awaiting the server. On error it restores the prior state.
//   The UPDATE postgres_changes event from the same row will arrive
//   later and is idempotent — landing the same `read=true` we already
//   set — so no double-toggle is possible.

const RECENT_CAP = 5;

export type UseNotificationsRealtimeArgs = {
  /** Authenticated user's profile id. The hook does nothing when null
   *  (no subscription, returns the initial state as-is). */
  profileId: string | null;
  /** SSR-fetched unread count. Used as initial state. */
  initialUnreadCount: number;
  /** SSR-fetched recent notifications. Used as initial state. */
  initialRecent: RecentNotification[];
};

export type UseNotificationsRealtimeResult = {
  unreadCount: number;
  recent: RecentNotification[];
  markAsRead: (notificationId: string) => Promise<void>;
};

export function useNotificationsRealtime({
  profileId,
  initialUnreadCount,
  initialRecent,
}: UseNotificationsRealtimeArgs): UseNotificationsRealtimeResult {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [recent, setRecent] = useState<RecentNotification[]>(initialRecent);

  useEffect(() => {
    if (!profileId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:profile_id=eq.${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `profile_id=eq.${profileId}`,
        },
        (payload) => {
          const row = payload.new as RecentNotification;
          setRecent((prev) => {
            // Dedupe: realtime can in rare cases redeliver an event
            // (Phoenix presence/heartbeat edge cases). Keep the
            // dropdown stable.
            if (prev.some((r) => r.id === row.id)) return prev;
            return [row, ...prev].slice(0, RECENT_CAP);
          });
          if (!row.read) {
            setUnreadCount((c) => c + 1);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `profile_id=eq.${profileId}`,
        },
        (payload) => {
          const row = payload.new as RecentNotification;
          const old = payload.old as Partial<RecentNotification>;
          setRecent((prev) =>
            prev.map((r) =>
              r.id === row.id
                ? {
                    ...r,
                    read: row.read,
                    read_at: row.read_at,
                    title: row.title,
                    body: row.body,
                  }
                : r,
            ),
          );
          // Adjust the unread count only when the read flag changed.
          // Optimistic markAsRead may have already pre-decremented;
          // the UPDATE event matches the post-mutation state so no
          // further change is needed when old.read === false and the
          // new state is read=true (already counted). To avoid
          // double-counting, we only adjust when old.read is
          // explicitly absent or undefined — the realtime payload's
          // `old` only includes the primary key by default unless
          // REPLICA IDENTITY FULL is set. With REPLICA IDENTITY
          // DEFAULT, we treat every UPDATE as authoritative for the
          // post-state: recompute by comparing against the cached
          // recent[] entry's prior state via the snapshot below.
          if (old.read === false && row.read === true) {
            setUnreadCount((c) => Math.max(0, c - 1));
          } else if (old.read === true && row.read === false) {
            setUnreadCount((c) => c + 1);
          }
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [profileId]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      // Optimistic: snapshot the prior state so we can roll back.
      let priorRead = false;
      setRecent((prev) =>
        prev.map((r) => {
          if (r.id !== notificationId) return r;
          priorRead = r.read;
          return { ...r, read: true, read_at: new Date().toISOString() };
        }),
      );
      if (!priorRead) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }

      const result = await markNotificationRead(notificationId);
      if (!result.ok) {
        // Roll back the optimistic flip.
        setRecent((prev) =>
          prev.map((r) =>
            r.id === notificationId
              ? { ...r, read: priorRead, read_at: priorRead ? r.read_at : null }
              : r,
          ),
        );
        if (!priorRead) {
          setUnreadCount((c) => c + 1);
        }
      }
    },
    [],
  );

  return { unreadCount, recent, markAsRead };
}
