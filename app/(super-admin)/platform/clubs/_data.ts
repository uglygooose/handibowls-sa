import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ThemePreset } from "@/components/brand/theme-presets";

export type DistrictRow = { id: string; name: string };

// Full district dropdown — there are ~20 BSA districts seeded in migration 003.
// Ordered by name so the wizard's select behaves predictably.
export async function listDistricts(): Promise<DistrictRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("districts")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw new Error(`listDistricts: ${error.message}`);
  return data ?? [];
}

export type ClubRow = {
  id: string;
  name: string;
  short_name: string | null;
  slug: string;
  city: string;
  active: boolean;
  theme_preset: ThemePreset;
  district_id: string;
  district_name: string | null;
  admin_display: string | null;
  admin_email: string | null;
  members_count: number;
  greens_count: number;
};

export type ListClubsResult = {
  rows: ClubRow[];
  total: number;
  page: number;
  pageSize: number;
};

function escapeOrLiteral(value: string): string {
  // PostgREST .or() splits on commas + parens; strip any stray double-quotes
  // from the user input so the wildcard wrap below is safe. ILIKE wildcards
  // (%) pass through verbatim.
  return value.replace(/"/g, "");
}

// Server-side paginated list of clubs with the joins we need for the platform
// clubs table. RLS (clubs_super_admin_all) gates access to super-admins.
//
// Phase 12 / 12-7: takes an optional `q` for server-side search across
// `name`, `short_name`, and `city` (ILIKE OR'd in one PostgREST query).
// Pre-12-7 the table did client-side `globalFilter` on the paginated subset,
// which only matched rows on the active page when the dataset spanned 2+
// pages. Pattern matches `listUsers` from `/platform/users` (the precedent
// for server-side `q` thread on a paginated TanStack Table).
export async function listClubs({
  q = "",
  page,
  pageSize,
}: {
  q?: string;
  page: number;
  pageSize: number;
}): Promise<ListClubsResult> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const trimmed = q.trim();

  let query = supabase
    .from("clubs")
    .select(
      `
      id, name, short_name, slug, city, active, theme_preset, district_id,
      districts(name),
      club_admin_assignments(profiles!profile_id(first_name, last_name, display_name, email)),
      club_memberships(count),
      greens(count)
      `,
      { count: "exact" },
    )
    .order("name", { ascending: true })
    .range(from, to);

  if (trimmed) {
    const wildcard = `%${escapeOrLiteral(trimmed)}%`;
    query = query.or(
      `name.ilike.${wildcard},short_name.ilike.${wildcard},city.ilike.${wildcard}`,
    );
  }

  const { data, count, error } = await query;

  if (error) throw new Error(`listClubs: ${error.message}`);

  const rows: ClubRow[] = (data ?? []).map((c) => {
    const firstAdmin = c.club_admin_assignments?.[0]?.profiles ?? null;
    const adminDisplay = firstAdmin
      ? [firstAdmin.first_name, firstAdmin.last_name].filter(Boolean).join(" ").trim() ||
        firstAdmin.display_name ||
        null
      : null;
    return {
      id: c.id,
      name: c.name,
      short_name: c.short_name,
      slug: c.slug,
      city: c.city,
      active: c.active,
      theme_preset: c.theme_preset as ThemePreset,
      district_id: c.district_id,
      district_name: c.districts?.name ?? null,
      admin_display: adminDisplay,
      admin_email: firstAdmin?.email ?? null,
      members_count: c.club_memberships?.[0]?.count ?? 0,
      greens_count: c.greens?.[0]?.count ?? 0,
    };
  });

  return {
    rows,
    total: count ?? rows.length,
    page,
    pageSize,
  };
}
