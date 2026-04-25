import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type UserRole = Database["public"]["Enums"]["user_role"];

export type UserClubRef = { id: string; name: string };

export type UserRow = {
  id: string;
  display: string;
  email: string | null;
  role: UserRole;
  profile_completed: boolean;
  created_at: string;
  clubs: UserClubRef[];
};

export type ListUsersResult = {
  rows: UserRow[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
};

export type UserDetail = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  profile_completed: boolean;
  created_at: string;
  updated_at: string;
  memberships: {
    club_id: string;
    club_name: string;
    status: string;
    is_primary: boolean;
    joined_at: string;
  }[];
  admin_assignments: {
    club_id: string;
    club_name: string;
    assigned_at: string;
  }[];
};

function display(p: {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
}): string {
  const full = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return full || p.display_name || p.email || "—";
}

// Embed shape used by listUsers + select() — kept close to the schema so the
// PostgREST embed string and the row mapper stay in sync.
//
// `club_admin_assignments` has two FKs back to `profiles`
// (`profile_id_fkey` for the admin and `assigned_by_fkey` for the assigner),
// so the reverse embed must name the constraint or PostgREST errors with
// "more than one relationship was found". `club_memberships` has a single FK
// (`profile_id_fkey`) and resolves unambiguously.
const PROFILE_SELECT = `
  id, first_name, last_name, display_name, email, role, profile_completed, created_at,
  club_memberships(club_id, clubs(id, name)),
  club_admin_assignments!club_admin_assignments_profile_id_fkey(club_id, clubs(id, name))
`;

type EmbeddedProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  role: UserRole;
  profile_completed: boolean;
  created_at: string;
  club_memberships?: { club_id: string; clubs: { id: string; name: string } | null }[] | null;
  club_admin_assignments?:
    | { club_id: string; clubs: { id: string; name: string } | null }[]
    | null;
};

function dedupeClubs(p: EmbeddedProfile): UserClubRef[] {
  const acc = new Map<string, UserClubRef>();
  for (const m of p.club_memberships ?? []) {
    if (m.clubs) acc.set(m.clubs.id, { id: m.clubs.id, name: m.clubs.name });
  }
  for (const a of p.club_admin_assignments ?? []) {
    if (a.clubs) acc.set(a.clubs.id, { id: a.clubs.id, name: a.clubs.name });
  }
  return [...acc.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function escapeOrLiteral(value: string): string {
  // PostgREST .or() splits on commas + parens, so values containing those
  // characters need wrapping with double-quotes. ILIKE wildcards (%) pass
  // through verbatim. Strip stray double-quotes from the user input first.
  return value.replace(/"/g, "");
}

// Server-paginated user list with optional cross-table search. RLS
// (`profiles_super_admin_all`, migration 010) gates this to super-admins.
//
// Search is a 4-way OR across profile fields plus an `id.in.(...)` lookup
// for club-name matches: we resolve matching club_ids → profile_ids first,
// then OR them into the filter so we keep server-side pagination + count.
export async function listUsers({
  q,
  page,
  pageSize,
}: {
  q: string;
  page: number;
  pageSize: number;
}): Promise<ListUsersResult> {
  const supabase = await createClient();
  const trimmed = q.trim();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("profiles")
    .select(PROFILE_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (trimmed) {
    const safe = escapeOrLiteral(trimmed);
    const wildcard = `%${safe}%`;

    // Step 1 — find clubs whose name matches the query.
    const { data: clubs, error: clubsErr } = await supabase
      .from("clubs")
      .select("id")
      .ilike("name", wildcard);
    if (clubsErr) throw new Error(`listUsers clubs: ${clubsErr.message}`);
    const clubIds = (clubs ?? []).map((c) => c.id);

    // Step 2 — for those clubs, collect profile_ids via memberships + admins.
    let profileIdsFromClubs: string[] = [];
    if (clubIds.length > 0) {
      const [{ data: memberRows, error: memErr }, { data: adminRows, error: admErr }] =
        await Promise.all([
          supabase
            .from("club_memberships")
            .select("profile_id")
            .in("club_id", clubIds),
          supabase
            .from("club_admin_assignments")
            .select("profile_id")
            .in("club_id", clubIds),
        ]);
      if (memErr) throw new Error(`listUsers memberships: ${memErr.message}`);
      if (admErr) throw new Error(`listUsers admin-assignments: ${admErr.message}`);
      profileIdsFromClubs = [
        ...new Set([
          ...(memberRows ?? []).map((r) => r.profile_id),
          ...(adminRows ?? []).map((r) => r.profile_id),
        ]),
      ];
    }

    // Step 3 — OR profile fields ilike + id.in.(uuids from clubs).
    const orParts = [
      `first_name.ilike.${wildcard}`,
      `last_name.ilike.${wildcard}`,
      `display_name.ilike.${wildcard}`,
      `email.ilike.${wildcard}`,
    ];
    if (profileIdsFromClubs.length > 0) {
      orParts.push(`id.in.(${profileIdsFromClubs.join(",")})`);
    }
    query = query.or(orParts.join(","));
  }

  const { data, count, error } = await query;
  if (error) throw new Error(`listUsers: ${error.message}`);

  const rows: UserRow[] = ((data ?? []) as unknown as EmbeddedProfile[]).map((p) => ({
    id: p.id,
    display: display(p),
    email: p.email,
    role: p.role,
    profile_completed: p.profile_completed,
    created_at: p.created_at,
    clubs: dedupeClubs(p),
  }));

  return {
    rows,
    total: count ?? rows.length,
    page,
    pageSize,
    q: trimmed,
  };
}

export async function getUserDetail(id: string): Promise<UserDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      id, first_name, last_name, display_name, email, phone, role,
      profile_completed, created_at, updated_at,
      club_memberships(club_id, status, is_primary, joined_at, clubs(id, name)),
      club_admin_assignments!club_admin_assignments_profile_id_fkey(
        club_id, assigned_at, clubs(id, name)
      )
      `,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getUserDetail: ${error.message}`);
  if (!data) return null;

  type DetailRow = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    email: string | null;
    phone: string | null;
    role: UserRole;
    profile_completed: boolean;
    created_at: string;
    updated_at: string;
    club_memberships?:
      | {
          club_id: string;
          status: string;
          is_primary: boolean;
          joined_at: string;
          clubs: { id: string; name: string } | null;
        }[]
      | null;
    club_admin_assignments?:
      | {
          club_id: string;
          assigned_at: string;
          clubs: { id: string; name: string } | null;
        }[]
      | null;
  };
  const row = data as unknown as DetailRow;

  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    display_name: row.display_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    profile_completed: row.profile_completed,
    created_at: row.created_at,
    updated_at: row.updated_at,
    memberships: (row.club_memberships ?? [])
      .filter((m) => m.clubs)
      .map((m) => ({
        club_id: m.club_id,
        club_name: m.clubs!.name,
        status: m.status,
        is_primary: m.is_primary,
        joined_at: m.joined_at,
      })),
    admin_assignments: (row.club_admin_assignments ?? [])
      .filter((a) => a.clubs)
      .map((a) => ({
        club_id: a.club_id,
        club_name: a.clubs!.name,
        assigned_at: a.assigned_at,
      })),
  };
}
