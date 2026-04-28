import "server-only";

import { getAuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type Gender = Database["public"]["Enums"]["gender"];
type PlayerPosition = Database["public"]["Enums"]["player_position"];

export type MemberStatus = "active" | "pending" | "expired";

export type MemberRow = {
  // 'member' for an accepted club_membership; 'invite' for a pending /
  // expired invite the admin has sent. Same column shape so the table
  // renders a single virtualised stream.
  kind: "member" | "invite";
  rowId: string;
  name: string | null;
  email: string;
  phone: string | null;
  bsa_number: string | null;
  gender: Gender | null;
  club_grading: PlayerPosition | null;
  status: MemberStatus;
  novice_until: string | null;
  last_active: string | null;
};

export type MembersData =
  | { ok: true; clubId: string; rows: MemberRow[] }
  | { ok: false; reason: "no-club" };

function fullName(first: string | null, last: string | null, display: string | null) {
  const composed = [first, last].filter(Boolean).join(" ").trim();
  return composed || display || null;
}

// "Novice-until" UI value. Player is a novice for 3 years from registration.
// novice_registered_at is a date column (no timezone) per migration 002.
function noviceUntil(registeredAt: string | null): string | null {
  if (!registeredAt) return null;
  const d = new Date(`${registeredAt}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 3);
  return d.toISOString().slice(0, 10);
}

export async function getMembersData(): Promise<MembersData> {
  const ctx = await getAuthContext();
  // Super-admin lands here without a club scope; the layout still allows them
  // in for parity. Surface an empty state rather than 500 — they'll use
  // /platform/clubs/[id] for real oversight.
  const clubId = ctx?.clubIds[0];
  if (!clubId) return { ok: false, reason: "no-club" };

  const supabase = await createClient();

  const [membersRes, invitesRes] = await Promise.all([
    supabase
      .from("club_memberships")
      .select(
        "status, club_grading, profile:profiles!inner(id, first_name, last_name, display_name, email, phone, bsa_number, gender, novice_registered_at, updated_at)",
      )
      .eq("club_id", clubId)
      .eq("status", "active"),
    supabase
      .from("invites")
      .select("id, email, first_name, last_name, status, expires_at, created_at")
      .eq("club_id", clubId)
      .eq("role", "player")
      .eq("status", "pending"),
  ]);

  const memberRows: MemberRow[] = (membersRes.data ?? []).map((m) => {
    const p = m.profile;
    return {
      kind: "member",
      rowId: `member-${p.id}`,
      name: fullName(p.first_name, p.last_name, p.display_name),
      email: p.email ?? "",
      phone: p.phone,
      bsa_number: p.bsa_number,
      gender: p.gender,
      club_grading: m.club_grading,
      status: "active",
      novice_until: noviceUntil(p.novice_registered_at),
      // profiles.updated_at fires on every row mutation — it's the closest
      // safe proxy for "last active" without exposing auth.users to PostgREST.
      last_active: p.updated_at,
    };
  });

  const now = Date.now();
  const inviteRows: MemberRow[] = (invitesRes.data ?? []).map((i) => ({
    kind: "invite",
    rowId: `invite-${i.id}`,
    name: fullName(i.first_name, i.last_name, null),
    email: i.email,
    phone: null,
    bsa_number: null,
    gender: null,
    club_grading: null,
    status: new Date(i.expires_at).getTime() < now ? "expired" : "pending",
    novice_until: null,
    last_active: i.created_at,
  }));

  // Sort: pending invites first (admin's open work), then active members
  // by name for stable scanning.
  const rows = [
    ...inviteRows.sort((a, b) => (a.email > b.email ? 1 : -1)),
    ...memberRows.sort((a, b) => {
      const an = (a.name ?? a.email).toLowerCase();
      const bn = (b.name ?? b.email).toLowerCase();
      return an > bn ? 1 : -1;
    }),
  ];

  return { ok: true, clubId, rows };
}
