// Phase 13 / 13-8 / Batch A — Demo seed clubs + districts + greens + rinks.
//
// Two clubs only:
//   • Demo Bowls Club (slug: demo-bowls-club, district: Boland,
//                      Cape Town, atomic-red theme) — primary anchor
//                      where admin@demo.local + coach@demo.local +
//                      captain@demo.local + player@demo.local +
//                      player2@demo.local live.
//                      Topology: 2 greens (Main, South) × 6 rinks
//                      total, with South 3 disabled-for-maintenance
//                      so the disabled-rink state is reachable on
//                      /manage/greens.
//   • Pinelands BC    (slug: pinelands-bc, district: Western Province,
//                      Cape Town, ocean-blue theme) — secondary
//                      anchor where admin2@demo.local lives;
//                      demonstrates cross-club isolation.
//                      Topology: 1 green × 4 rinks (minimum to
//                      function — admin2 needs ≥1 active rink to
//                      seed availability + book against).
//
// Idempotent via the unique (slug) constraint — re-running upserts.

import { logSection, type Admin } from "./_lib";

const DEMO_CLUB = {
  slug: "demo-bowls-club",
  name: "Demo Bowls Club",
  short_name: "Demo BC",
  city: "Cape Town",
  district_name: "Boland",
  theme: "atomic-red" as const,
};

const PINELANDS = {
  slug: "pinelands-bc",
  name: "Pinelands BC",
  short_name: "Pinelands",
  city: "Cape Town",
  district_name: "Western Province",
  theme: "ocean-blue" as const,
};

export type DistrictMap = Map<string, string>;

export async function ensureDistricts(client: Admin): Promise<DistrictMap> {
  // Migration 003 seeds all 20 BSA districts at install time. We
  // don't write — we read + verify all 20 are present + return a
  // name → id map for the clubs fixture.
  const { data, error } = await client.from("districts").select("id, name");
  if (error) throw error;

  const map = new Map<string, string>(
    (data ?? []).map((d) => [d.name, d.id]),
  );

  if (map.size < 20) {
    throw new Error(
      `Expected 20 BSA districts (migration 003 seed); found ${map.size}. ` +
        `Has the migration been applied to this Supabase project?`,
    );
  }

  console.log(`  districts — verified ${map.size} BSA districts present`);
  return map;
}

export type ClubRow = {
  id: string;
  slug: string;
  name: string;
};

export async function seedClubs(
  client: Admin,
  districts: DistrictMap,
): Promise<{ demo: ClubRow; pinelands: ClubRow }> {
  logSection("Demo seed — clubs + greens + rinks");

  const demo = await upsertClub(client, {
    slug: DEMO_CLUB.slug,
    name: DEMO_CLUB.name,
    short_name: DEMO_CLUB.short_name,
    city: DEMO_CLUB.city,
    district_id: requireDistrict(districts, DEMO_CLUB.district_name),
    theme_preset: DEMO_CLUB.theme,
  });
  await ensureDemoBowlsClubGreens(client, demo.id);

  const pinelands = await upsertClub(client, {
    slug: PINELANDS.slug,
    name: PINELANDS.name,
    short_name: PINELANDS.short_name,
    city: PINELANDS.city,
    district_id: requireDistrict(districts, PINELANDS.district_name),
    theme_preset: PINELANDS.theme,
  });
  await ensureSingleGreen(client, pinelands.id, "Main", 4);

  console.log(`  clubs — seeded 2 anchors (Demo Bowls Club + Pinelands BC)`);

  return { demo, pinelands };
}

function requireDistrict(map: DistrictMap, name: string): string {
  const id = map.get(name);
  if (!id) {
    throw new Error(`District not found: ${name}`);
  }
  return id;
}

async function upsertClub(
  client: Admin,
  input: {
    slug: string;
    name: string;
    short_name: string | null;
    city: string;
    district_id: string;
    theme_preset: "atomic-red" | "ocean-blue";
  },
): Promise<ClubRow> {
  const { data, error } = await client
    .from("clubs")
    .upsert(
      {
        slug: input.slug,
        name: input.name,
        short_name: input.short_name,
        city: input.city,
        district_id: input.district_id,
        theme_preset: input.theme_preset,
        active: true,
      },
      { onConflict: "slug" },
    )
    .select("id, slug, name")
    .single();
  if (error) throw error;
  return { id: data.id, slug: data.slug, name: data.name };
}

// Demo Bowls Club: 2 greens × 5 rinks active + 1 rink disabled
// (South 3) so the maintenance-disabled state is reachable on
// /manage/greens.
async function ensureDemoBowlsClubGreens(client: Admin, clubId: string) {
  const greens: Array<{ name: string; rinks: Array<{ number: number; active: boolean }> }> = [
    {
      name: "Main",
      rinks: [
        { number: 1, active: true },
        { number: 2, active: true },
        { number: 3, active: true },
      ],
    },
    {
      name: "South",
      rinks: [
        { number: 1, active: true },
        { number: 2, active: true },
        { number: 3, active: false },
      ],
    },
  ];

  for (const g of greens) {
    const { data: greenRow, error: greenErr } = await client
      .from("greens")
      .upsert(
        {
          club_id: clubId,
          name: g.name,
          rink_count: g.rinks.length,
          active: true,
        },
        { onConflict: "club_id,name" },
      )
      .select("id")
      .single();
    if (greenErr) throw greenErr;

    const rinkRows = g.rinks.map((r) => ({
      green_id: greenRow.id,
      number: r.number,
      active: r.active,
    }));
    const { error: rinkErr } = await client
      .from("rinks")
      .upsert(rinkRows, { onConflict: "green_id,number" });
    if (rinkErr) throw rinkErr;
  }
}

async function ensureSingleGreen(
  client: Admin,
  clubId: string,
  greenName: string,
  rinkCount: number,
) {
  const { data: greenRow, error: greenErr } = await client
    .from("greens")
    .upsert(
      {
        club_id: clubId,
        name: greenName,
        rink_count: rinkCount,
        active: true,
      },
      { onConflict: "club_id,name" },
    )
    .select("id")
    .single();
  if (greenErr) throw greenErr;

  const rinks = Array.from({ length: rinkCount }, (_, i) => ({
    green_id: greenRow.id,
    number: i + 1,
    active: true,
  }));
  const { error: rinkErr } = await client
    .from("rinks")
    .upsert(rinks, { onConflict: "green_id,number" });
  if (rinkErr) throw rinkErr;
}
