import "server-only";

import { getAuthContext } from "@/lib/auth/role";
import { getCurrentHostClub } from "@/lib/auth/memberships";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

// Phase 11 / 11-3 — admin Messages data layer.
//
// Fetchers backing /manage/messages (list) and /manage/messages/new
// (compose). Server-only — every callsite is a Server Component or
// Server Action.
//
// Three list-shaped fetchers feed the compose form's audience
// picker:
//
//   listMessagesForClub          list page row set
//   listTournamentsForClub       Tournament dropdown
//   listMembersForClub           Custom multi-select roster
//   resolveAudienceCount         Live recipient-count preview
//                                (mirrors send_message RPC's
//                                resolution but read-only — no
//                                fan-out side effects)
//
// All fetchers are RLS-scoped via the authenticated supabase
// client. The compose UI's audience preview uses the same RLS
// surface the send action will use, so a count of 5 here means a
// fan-out of exactly 5 on Send.

type DbMessageStatus = Database["public"]["Enums"]["message_status"];
type DbAudienceKind = "all_members" | "tournament_entrants" | "custom";

export type MessageListRow = {
  id: string;
  club_id: string;
  subject: string;
  body_preview: string;
  audience_kind: DbAudienceKind;
  audience_tournament_id: string | null;
  audience_tournament_name: string | null;
  audience_custom_count: number;
  status: DbMessageStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  recipient_count: number;
  /** Profile id of the sender. Surfaces alongside sender_name so the
   *  list-row can render a "Schedule from this request" CTA against
   *  player-initiated Twenty 20 assessment requests (12-1 followup). */
  sender_id: string | null;
  sender_name: string | null;
};

export type ListMessagesResult =
  | {
      ok: true;
      clubId: string;
      clubName: string;
      rows: MessageListRow[];
    }
  | { ok: false; reason: "no-club" | "error"; error?: string };

export async function listMessagesForClub(): Promise<ListMessagesResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, reason: "no-club" };

  const club = await getCurrentHostClub();
  if (!club) return { ok: false, reason: "no-club" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, club_id, subject, body_md, audience_kind, audience_tournament_id, audience_profile_ids, status, scheduled_at, sent_at, created_at, recipient_count, sender_id, sender:profiles!sender_id(first_name, last_name, display_name), tournament:tournaments!audience_tournament_id(name)",
    )
    .eq("club_id", club.club_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[messages] list fetch failed:", error);
    return { ok: false, reason: "error", error: error.message };
  }

  const rows: MessageListRow[] = (data ?? []).map((r) => {
    const sender = r.sender as
      | {
          first_name?: string | null;
          last_name?: string | null;
          display_name?: string | null;
        }
      | null;
    const tournament = r.tournament as { name?: string } | null;
    const audienceKind = (r.audience_kind ?? "all_members") as DbAudienceKind;
    const customIds = Array.isArray(r.audience_profile_ids)
      ? r.audience_profile_ids
      : [];
    return {
      id: r.id,
      club_id: r.club_id,
      subject: r.subject,
      body_preview: previewFromMarkdown(r.body_md ?? ""),
      audience_kind: audienceKind,
      audience_tournament_id: r.audience_tournament_id,
      audience_tournament_name: tournament?.name ?? null,
      audience_custom_count: customIds.length,
      status: r.status,
      scheduled_at: r.scheduled_at,
      sent_at: r.sent_at,
      created_at: r.created_at,
      recipient_count: r.recipient_count ?? 0,
      sender_id: r.sender_id ?? null,
      sender_name: senderName(sender),
    };
  });

  return {
    ok: true,
    clubId: club.club_id,
    clubName: club.club_name,
    rows,
  };
}

// ---------------------------------------------------------------------
// Compose form fetchers
// ---------------------------------------------------------------------

export type MessageDetailRow = MessageListRow & {
  body_md: string;
  audience_profile_ids: string[];
};

export type DetailResult =
  | { ok: true; data: MessageDetailRow }
  | { ok: false; reason: "not-found" | "no-club" | "error"; error?: string };

export async function getMessageDetail(id: string): Promise<DetailResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, reason: "no-club" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, club_id, subject, body_md, audience_kind, audience_tournament_id, audience_profile_ids, status, scheduled_at, sent_at, created_at, recipient_count, sender_id, sender:profiles!sender_id(first_name, last_name, display_name), tournament:tournaments!audience_tournament_id(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[messages] detail fetch failed:", error);
    return { ok: false, reason: "error", error: error.message };
  }
  if (!data) return { ok: false, reason: "not-found" };

  const sender = data.sender as
    | {
        first_name?: string | null;
        last_name?: string | null;
        display_name?: string | null;
      }
    | null;
  const tournament = data.tournament as { name?: string } | null;
  const audienceKind = (data.audience_kind ?? "all_members") as DbAudienceKind;
  const customIds = Array.isArray(data.audience_profile_ids)
    ? data.audience_profile_ids
    : [];

  return {
    ok: true,
    data: {
      id: data.id,
      club_id: data.club_id,
      subject: data.subject,
      body_md: data.body_md,
      body_preview: previewFromMarkdown(data.body_md ?? ""),
      audience_kind: audienceKind,
      audience_tournament_id: data.audience_tournament_id,
      audience_tournament_name: tournament?.name ?? null,
      audience_profile_ids: customIds,
      audience_custom_count: customIds.length,
      status: data.status,
      scheduled_at: data.scheduled_at,
      sent_at: data.sent_at,
      created_at: data.created_at,
      recipient_count: data.recipient_count ?? 0,
      sender_id: data.sender_id ?? null,
      sender_name: senderName(sender),
    },
  };
}

export type TournamentOption = {
  id: string;
  name: string;
  format: Database["public"]["Enums"]["tournament_format"];
  status: Database["public"]["Enums"]["tournament_status"];
  starts_at: string | null;
};

export type TournamentsResult =
  | { ok: true; rows: TournamentOption[] }
  | { ok: false; reason: "no-club" | "error"; error?: string };

export async function listTournamentsForClub(): Promise<TournamentsResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, reason: "no-club" };
  const club = await getCurrentHostClub();
  if (!club) return { ok: false, reason: "no-club" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, format, status, starts_at")
    .eq("host_club_id", club.club_id)
    .order("starts_at", { ascending: false });

  if (error) {
    console.error("[messages] tournaments fetch failed:", error);
    return { ok: false, reason: "error", error: error.message };
  }
  return {
    ok: true,
    rows: (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      format: r.format,
      status: r.status,
      starts_at: r.starts_at,
    })),
  };
}

export type MemberOption = {
  profile_id: string;
  name: string | null;
  email: string | null;
  bsa_number: string | null;
};

export type MembersResult =
  | { ok: true; rows: MemberOption[] }
  | { ok: false; reason: "no-club" | "error"; error?: string };

export async function listMembersForClub(): Promise<MembersResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, reason: "no-club" };
  const club = await getCurrentHostClub();
  if (!club) return { ok: false, reason: "no-club" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_memberships")
    .select(
      "profile:profiles!inner(id, first_name, last_name, display_name, email, bsa_number)",
    )
    .eq("club_id", club.club_id)
    .eq("status", "active");

  if (error) {
    console.error("[messages] members fetch failed:", error);
    return { ok: false, reason: "error", error: error.message };
  }

  const rows: MemberOption[] = (data ?? []).map((m) => {
    const p = m.profile as {
      id: string;
      first_name: string | null;
      last_name: string | null;
      display_name: string | null;
      email: string | null;
      bsa_number: string | null;
    };
    return {
      profile_id: p.id,
      name: senderName(p),
      email: p.email,
      bsa_number: p.bsa_number,
    };
  });

  rows.sort((a, b) => {
    if (a.name === b.name) return 0;
    if (!a.name) return 1;
    if (!b.name) return -1;
    return a.name.localeCompare(b.name, "en-ZA", { sensitivity: "base" });
  });

  return { ok: true, rows };
}

// ---------------------------------------------------------------------
// Audience preview — counts only, no fan-out side effects
// ---------------------------------------------------------------------
//
// Mirrors public.send_message's audience-resolution (migration 035)
// using the same RLS-scoped client. Used by the compose form to
// surface "Estimated recipients: N" before submit. Not a substitute
// for the RPC's actual fan-out — counts shown here can change
// between preview and Send if (rare) memberships flip in the
// intervening window.

export type AudiencePreview = {
  count: number;
  kind: DbAudienceKind;
};

export async function resolveAudienceCount(input: {
  audience_kind: DbAudienceKind;
  audience_tournament_id?: string | null;
  audience_profile_ids?: string[];
}): Promise<AudiencePreview | null> {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const club = await getCurrentHostClub();
  if (!club) return null;

  const supabase = await createClient();

  if (input.audience_kind === "all_members") {
    const { count } = await supabase
      .from("club_memberships")
      .select("profile_id", { count: "exact", head: true })
      .eq("club_id", club.club_id)
      .eq("status", "active");
    return { count: count ?? 0, kind: "all_members" };
  }

  if (input.audience_kind === "tournament_entrants") {
    if (!input.audience_tournament_id) {
      return { count: 0, kind: "tournament_entrants" };
    }
    // UNION of singles + team_members; mirrors migration 035.
    const [{ data: entries }, { data: teamMembers }] = await Promise.all([
      supabase
        .from("tournament_entries")
        .select("profile_id")
        .eq("tournament_id", input.audience_tournament_id)
        .eq("withdrawn", false)
        .not("profile_id", "is", null),
      supabase
        .from("tournament_team_members")
        .select("profile_id, team:tournament_teams!inner(tournament_id, withdrawn)")
        .eq("team.tournament_id", input.audience_tournament_id)
        .eq("team.withdrawn", false),
    ]);
    const ids = new Set<string>();
    for (const r of entries ?? []) {
      if (r.profile_id) ids.add(r.profile_id);
    }
    for (const r of teamMembers ?? []) {
      if (r.profile_id) ids.add(r.profile_id);
    }
    return { count: ids.size, kind: "tournament_entrants" };
  }

  // custom — intersect with active club members.
  const wanted = new Set(input.audience_profile_ids ?? []);
  if (wanted.size === 0) return { count: 0, kind: "custom" };
  const { data } = await supabase
    .from("club_memberships")
    .select("profile_id")
    .eq("club_id", club.club_id)
    .eq("status", "active")
    .in("profile_id", Array.from(wanted));
  return { count: (data ?? []).length, kind: "custom" };
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function senderName(
  p: {
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
  } | null,
): string | null {
  if (!p) return null;
  if (p.display_name) return p.display_name;
  const composed = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return composed || null;
}

function previewFromMarkdown(md: string): string {
  // Mirrors lib/inbox preview pattern — strip aggressive markers, collapse
  // whitespace, truncate at 140 chars. Inbox + admin list use the same
  // shape so the admin sees roughly what the player will read.
  const flat = md
    .replace(/[*_`#>~\[\]\(\)]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > 140 ? flat.slice(0, 140).trim() + "…" : flat;
}
