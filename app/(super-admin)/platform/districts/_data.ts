import "server-only";

import { createClient } from "@/lib/supabase/server";

export type DistrictWithCount = {
  id: string;
  name: string;
  province: string;
  clubs_count: number;
};

// Read-only platform districts list. The 20 BSA districts are fixed seed data
// (migration 003), so this loads everything in one shot — no pagination.
// `clubs_count` is a postgrest aggregate count over the clubs FK.
export async function listDistrictsWithClubCount(): Promise<DistrictWithCount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("districts")
    .select("id, name, province, clubs(count)")
    .order("name", { ascending: true });
  if (error) throw new Error(`listDistrictsWithClubCount: ${error.message}`);
  return (data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    province: d.province,
    clubs_count: d.clubs?.[0]?.count ?? 0,
  }));
}
