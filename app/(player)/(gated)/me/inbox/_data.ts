import "server-only";

import { getAuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";

// Phase 8a — /me/inbox data fetchers. Two streams:
//   • notifications  — system events (match reminders, draws, T20).
//                      Sourced from `public.notifications` (Phase 2 mig 008).
//   • messages       — club-admin broadcasts surfaced via the recipients
//                      fan-out table. Joined with `public.messages` for
//                      the subject + body preview.
//
// Both are RLS-scoped to the caller. Notifications include unread state
// for the dot indicator; the inbox page marks them read on visit (8a
// skips the mutation until the realtime subscription lands in 8d, so
// unread state currently persists across visits — flagged in Phase 11).

export type InboxNotification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
};

export type InboxMessage = {
  id: string;
  subject: string;
  preview: string;
  from_club: string;
  in_app_status: "unread" | "read";
  channel: "email" | "in_app" | "both";
  sent_at: string | null;
};

export async function getNotificationsForCurrentPlayer(
  limit = 50,
): Promise<InboxNotification[]> {
  const ctx = await getAuthContext();
  if (!ctx) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, read, created_at")
    .eq("profile_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    read: n.read,
    created_at: n.created_at,
  }));
}

export async function getMessagesForCurrentPlayer(
  limit = 50,
): Promise<InboxMessage[]> {
  const ctx = await getAuthContext();
  if (!ctx) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("message_recipients")
    .select(
      "id, in_app_status, sent_at, message:messages(id, subject, body_md, send_in_app, send_email, club:clubs!club_id(name))",
    )
    .eq("profile_id", ctx.userId)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const msg = row.message as {
      id: string;
      subject: string;
      body_md: string;
      send_in_app: boolean;
      send_email: boolean;
      club?: { name?: string } | null;
    } | null;
    return {
      id: row.id,
      subject: msg?.subject ?? "(no subject)",
      preview: previewFromMarkdown(msg?.body_md ?? ""),
      from_club: msg?.club?.name ?? "Club",
      in_app_status: row.in_app_status === "unread" ? "unread" : "read",
      channel: channelFor(msg?.send_in_app ?? true, msg?.send_email ?? false),
      sent_at: row.sent_at,
    };
  });
}

// Strip the most-aggressive markdown markers for the inbox preview.
// The full body is rendered server-side in Phase 11 once the message
// detail surface lands; this is a lightweight strip-and-truncate.
function previewFromMarkdown(md: string): string {
  const flat = md
    .replace(/[*_`#>~\[\]\(\)]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > 140 ? flat.slice(0, 140).trim() + "…" : flat;
}

function channelFor(
  inApp: boolean,
  email: boolean,
): InboxMessage["channel"] {
  if (inApp && email) return "both";
  if (email) return "email";
  return "in_app";
}
