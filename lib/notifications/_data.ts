import "server-only";

import { getAuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";

import type { InitialNotifications, RecentNotification } from "./types";

// Phase 11 / 11-5 — server-side initial fetch for the bell.
//
// One round-trip + one count query, both RLS-scoped. The realtime
// hook starts with this snapshot and only handles deltas — saves
// the client an extra fetch on mount.
//
// Indexes drive the queries:
//   notifications_profile_created_idx  → recent ORDER BY created_at DESC
//   notifications_profile_read_idx      → unread COUNT WHERE read=false
//
// Both already exist on cloud (verified via Supabase MCP at 11-5
// pre-flight).

const RECENT_LIMIT = 5;

export async function getInitialNotifications(): Promise<InitialNotifications> {
  const ctx = await getAuthContext();
  if (!ctx) return { unreadCount: 0, recent: [] };

  const supabase = await createClient();
  const [{ count }, { data: rows }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", ctx.userId)
      .eq("read", false),
    supabase
      .from("notifications")
      .select(
        "id, kind, title, body, related_kind, related_id, read, read_at, created_at",
      )
      .eq("profile_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(RECENT_LIMIT),
  ]);

  const recent: RecentNotification[] = (rows ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    related_kind: r.related_kind,
    related_id: r.related_id,
    read: r.read,
    read_at: r.read_at,
    created_at: r.created_at,
  }));

  return { unreadCount: count ?? 0, recent };
}
