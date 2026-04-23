import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ThemePreset } from "@/components/brand/ThemeApplier";

export type ClubAdmin = {
  profile_id: string;
  assigned_at: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
};

export type ClubGreen = {
  id: string;
  name: string;
  rink_count: number;
  surface: string | null;
  active: boolean;
};

export type ClubMember = {
  profile_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  status: string;
  is_primary: boolean;
  joined_at: string;
};

export type ClubTournament = {
  id: string;
  name: string;
  status: string;
  format: string;
  structure: string;
  starts_at: string | null;
};

export type ClubDetail = {
  id: string;
  name: string;
  short_name: string | null;
  slug: string;
  city: string;
  active: boolean;
  theme_preset: ThemePreset;
  district_id: string;
  district_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
};

// Fetch the top-level club row + district name. Separate from the per-tab
// loaders so the shell can render immediately while tabs stream their rows.
export async function getClubDetail(clubId: string): Promise<ClubDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clubs")
    .select(
      `id, name, short_name, slug, city, active, theme_preset, district_id,
       contact_email, contact_phone, logo_url, created_at, updated_at,
       districts(name)`,
    )
    .eq("id", clubId)
    .maybeSingle();
  if (error) throw new Error(`getClubDetail: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    short_name: data.short_name,
    slug: data.slug,
    city: data.city,
    active: data.active,
    theme_preset: data.theme_preset as ThemePreset,
    district_id: data.district_id,
    district_name: data.districts?.name ?? null,
    contact_email: data.contact_email,
    contact_phone: data.contact_phone,
    logo_url: data.logo_url,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function getClubAdmins(clubId: string): Promise<ClubAdmin[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_admin_assignments")
    .select(
      `profile_id, assigned_at,
       profiles!profile_id(first_name, last_name, display_name, email)`,
    )
    .eq("club_id", clubId)
    .order("assigned_at", { ascending: true });
  if (error) throw new Error(`getClubAdmins: ${error.message}`);
  return (data ?? []).map((row) => ({
    profile_id: row.profile_id,
    assigned_at: row.assigned_at,
    first_name: row.profiles?.first_name ?? null,
    last_name: row.profiles?.last_name ?? null,
    display_name: row.profiles?.display_name ?? null,
    email: row.profiles?.email ?? null,
  }));
}

export async function getClubGreens(clubId: string): Promise<ClubGreen[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("greens")
    .select("id, name, rink_count, surface, active")
    .eq("club_id", clubId)
    .order("name", { ascending: true });
  if (error) throw new Error(`getClubGreens: ${error.message}`);
  return data ?? [];
}

export async function getClubMembers(clubId: string): Promise<ClubMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_memberships")
    .select(
      `profile_id, status, is_primary, joined_at,
       profiles(first_name, last_name, display_name, email)`,
    )
    .eq("club_id", clubId)
    .order("joined_at", { ascending: true });
  if (error) throw new Error(`getClubMembers: ${error.message}`);
  return (data ?? []).map((row) => ({
    profile_id: row.profile_id,
    status: row.status,
    is_primary: row.is_primary,
    joined_at: row.joined_at,
    first_name: row.profiles?.first_name ?? null,
    last_name: row.profiles?.last_name ?? null,
    display_name: row.profiles?.display_name ?? null,
    email: row.profiles?.email ?? null,
  }));
}

export async function getClubTournaments(clubId: string): Promise<ClubTournament[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, status, format, structure, starts_at")
    .eq("host_club_id", clubId)
    .order("starts_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`getClubTournaments: ${error.message}`);
  return data ?? [];
}
