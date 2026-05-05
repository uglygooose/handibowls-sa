// Phase 13 / 13-8 / Batch A — Demo seed clubs + districts + greens + rinks.
//
// Topology:
//   • 2 anchor clubs the operator demos against:
//       Demo Bowls Club (slug: demo-bowls-club, district: Boland,
//                        Cape Town, atomic-red theme)
//       Pinelands BC    (slug: pinelands-bc, district: Western Province,
//                        Cape Town, ocean-blue theme)
//   • 4 "real-feeling" district-spanning clubs the operator can speak
//     to as if they were neighbouring clubs (Constantia, Stellenbosch,
//     Wynberg, Sea Point).
//   • ~58 bulk filler clubs spread across all 20 BSA districts so the
//     /platform/clubs surface paginates (>50 = page 2 demo).
//
// Total: ~60+ clubs. Demo Bowls Club gets 2 greens × 5 rinks (the
// existing seed-dev-users.ts topology) plus 1 disabled-for-maintenance
// rink for the demo. Pinelands BC gets 1 green × 4 rinks. Filler clubs
// get a single green × 6 rinks each (default rink_count).
//
// Idempotent via the unique (slug) constraint — re-running upserts.
// On the demo Supabase the reset script already wiped clubs by slug
// pattern; this seed re-creates from scratch.

import { slugify, logSection, type Admin } from "./_lib";

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

// "Real-feeling" anchor neighbours — 4 named clubs spread across
// Western Cape districts the operator's likely first pilot cohort
// will come from. Demo focus: super-admin's cross-club view feels
// populated with believable names rather than `demo-club-007`.
const NAMED_NEIGHBOURS: Array<{
  name: string;
  city: string;
  district_name: string;
  theme: "atomic-red" | "ocean-blue" | "sunburst" | "midnight" | "ruby" | "ocean-green" | "grape" | "white-speckle" | "core-black";
}> = [
  { name: "Constantia BC", city: "Cape Town", district_name: "Western Province", theme: "ocean-green" },
  { name: "Stellenbosch BC", city: "Stellenbosch", district_name: "Boland", theme: "ruby" },
  { name: "Wynberg BC", city: "Cape Town", district_name: "Western Province", theme: "midnight" },
  { name: "Sea Point BC", city: "Cape Town", district_name: "Western Province", theme: "sunburst" },
];

// Bulk filler club name + city pools. Names rotated through districts
// to ensure cross-district coverage; the pagination-demo target is >50
// total clubs so /platform/clubs paginates. A real BSA club registry
// would be substantially larger but 60 is the brief's floor.
const FILLER_NAME_PATTERNS = [
  "Riverside Bowls Club",
  "Highlands BC",
  "Greenfields BC",
  "Lakeside BC",
  "Central BC",
  "Northgate BC",
  "Southview BC",
  "Westlake BC",
  "Eastside BC",
  "Park BC",
];

const FILLER_CITY_BY_DISTRICT: Record<string, string[]> = {
  Boland: ["Paarl", "Worcester", "Wellington", "Robertson"],
  Border: ["East London", "King William's Town", "Mthatha"],
  "Bowls Gauteng North": ["Pretoria", "Centurion", "Hatfield"],
  Eden: ["George", "Knysna", "Mossel Bay", "Plettenberg Bay"],
  Ekurhuleni: ["Benoni", "Boksburg", "Germiston", "Kempton Park"],
  "Eastern Province": ["Port Elizabeth", "Uitenhage", "Despatch"],
  Johannesburg: ["Johannesburg", "Sandton", "Randburg", "Roodepoort"],
  Kingfisher: ["Durban", "Pinetown", "Hillcrest"],
  "KwaZulu-Natal Country": ["Pietermaritzburg", "Howick", "Ladysmith"],
  Limpopo: ["Polokwane", "Tzaneen", "Mokopane"],
  Mpumalanga: ["Nelspruit", "Witbank", "Secunda"],
  "Natal Inland": ["Pietermaritzburg", "Estcourt", "Greytown"],
  "North West": ["Rustenburg", "Klerksdorp", "Potchefstroom"],
  "Northern Cape": ["Kimberley", "Upington", "Kuruman"],
  "Northern Free State": ["Welkom", "Sasolburg", "Parys"],
  "Port Natal": ["Durban", "Umhlanga", "Ballito"],
  Sables: ["Witbank", "Middelburg", "Bethal"],
  Sedibeng: ["Vereeniging", "Vanderbijlpark", "Meyerton"],
  "Southern Free State": ["Bloemfontein", "Botshabelo", "Welkom"],
  "Western Province": ["Cape Town", "Bellville", "Goodwood", "Parow"],
};

const FILLER_THEMES = [
  "atomic-red",
  "ocean-blue",
  "sunburst",
  "midnight",
  "ruby",
  "ocean-green",
  "grape",
  "white-speckle",
  "core-black",
] as const;

export type DistrictMap = Map<string, string>;

export async function ensureDistricts(client: Admin): Promise<DistrictMap> {
  // Migration 003 seeds all 20 BSA districts at install time. We
  // don't write — we read + verify all 20 are present + return a
  // name → id map for the clubs fixture.
  const { data, error } = await client
    .from("districts")
    .select("id, name");
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
): Promise<{ demo: ClubRow; pinelands: ClubRow; all: ClubRow[] }> {
  logSection("Demo seed — clubs + greens + rinks");

  const demo = await upsertClub(client, {
    slug: DEMO_CLUB.slug,
    name: DEMO_CLUB.name,
    short_name: DEMO_CLUB.short_name,
    city: DEMO_CLUB.city,
    district_id: requireDistrict(districts, DEMO_CLUB.district_name),
    theme_preset: DEMO_CLUB.theme,
  });
  await ensureGreensAndRinksFull(client, demo.id);

  const pinelands = await upsertClub(client, {
    slug: PINELANDS.slug,
    name: PINELANDS.name,
    short_name: PINELANDS.short_name,
    city: PINELANDS.city,
    district_id: requireDistrict(districts, PINELANDS.district_name),
    theme_preset: PINELANDS.theme,
  });
  await ensureSingleGreen(client, pinelands.id, "Main", 4);

  const named: ClubRow[] = [];
  for (const n of NAMED_NEIGHBOURS) {
    const slug = `demo-${slugify(n.name)}`;
    const row = await upsertClub(client, {
      slug,
      name: n.name,
      short_name: null,
      city: n.city,
      district_id: requireDistrict(districts, n.district_name),
      theme_preset: n.theme,
    });
    await ensureSingleGreen(client, row.id, "Main", 6);
    named.push(row);
  }

  // Bulk fillers — name them deterministically by district + index so
  // `Demo bulk pagination` reads the same way every reset. Slugs
  // encode district + index so the pattern survives renames.
  const fillerRows: ClubRow[] = [];
  let fillerIdx = 0;
  for (const [districtName, cities] of Object.entries(FILLER_CITY_BY_DISTRICT)) {
    const districtId = requireDistrict(districts, districtName);
    // Spread ~3 fillers per district → ~60 across 20 districts.
    for (let i = 0; i < 3; i++) {
      const namePattern =
        FILLER_NAME_PATTERNS[
          (fillerIdx + i) % FILLER_NAME_PATTERNS.length
        ];
      const city = cities[i % cities.length];
      const fillerName = `${namePattern} ${districtName.split(" ")[0]} ${i + 1}`;
      const slug = `demo-club-${String(fillerIdx + 1).padStart(3, "0")}`;
      const theme = FILLER_THEMES[fillerIdx % FILLER_THEMES.length];
      const row = await upsertClub(client, {
        slug,
        name: fillerName,
        short_name: null,
        city,
        district_id: districtId,
        theme_preset: theme,
      });
      await ensureSingleGreen(client, row.id, "Main", 6);
      fillerRows.push(row);
      fillerIdx++;
    }
  }

  const all = [demo, pinelands, ...named, ...fillerRows];
  console.log(
    `  clubs — seeded ${all.length} total (2 anchors + ${named.length} named + ${fillerRows.length} bulk fillers)`,
  );

  return { demo, pinelands, all };
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
    theme_preset:
      | "atomic-red"
      | "ocean-blue"
      | "sunburst"
      | "midnight"
      | "ruby"
      | "ocean-green"
      | "grape"
      | "white-speckle"
      | "core-black";
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

// Demo Bowls Club gets the existing seed-dev-users.ts topology
// (2 greens × 5 rinks) plus an additional inactive rink for the demo
// so the maintenance-disabled state is reachable on /manage/greens.
async function ensureGreensAndRinksFull(client: Admin, clubId: string) {
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
        { number: 3, active: false }, // disabled-for-maintenance demo
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
