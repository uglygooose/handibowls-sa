// lib/tournaments/seeding.ts
//
// Seeding primitive — three named methods, admin-picks-at-creation.
// Operates on whole TEAMS (pre-formed by entrants), not individual players.
// No handicap-balancing logic — handicap is a club-admin decision at entry,
// not a system algorithm. See bsa-terminology skill.
//
// Method semantics:
//   • random — shuffle entries, pair sequentially. Default. Most clubs.
//   • seeded — order by entry.seed asc (1, 2, 3, …, N), then 1 vs N,
//             2 vs N-1, etc. Standard knockout-bracket seeding.
//   • sectional — split entries into groups (size derived from
//             entries.length and `sectionSize`), round-robin within group,
//             top M advance to knockout. THIS PRIMITIVE only assigns
//             section labels; the round-robin fixture generator + knockout
//             cutoff live elsewhere (round-robin in Phase 7+, sectional
//             knockout cutoff in a future phase).

export type SeedingMethod = "random" | "seeded" | "sectional";

export type SeedingTeam = {
  id: string;
  /** Optional pre-assigned seed value; lower is higher-ranked. */
  seed?: number | null;
};

export type SeedingResult = {
  /** Ordered list of teams keyed by id, in the seeded draw order. */
  ordered: { id: string; seed: number; section_label: string | null }[];
  /** Adjacent pairings that the bracket generator turns into round-1
   *  matches. For the random/seeded methods this is the full set. For
   *  sectional this is null — round-1 fixtures come from the round-robin
   *  generator, not from a knockout pairing. */
  pairings: ReadonlyArray<readonly [string, string | null]> | null;
};

// -------------------- helpers --------------------

function assertUniqueIds(teams: SeedingTeam[]) {
  const seen = new Set<string>();
  for (const t of teams) {
    if (seen.has(t.id)) {
      throw new Error(`seeding: duplicate team id ${t.id}`);
    }
    seen.add(t.id);
  }
}

/** Mulberry32 — small, deterministic PRNG keyed on a seed integer. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pairAdjacent(ordered: { id: string }[]): ReadonlyArray<readonly [string, string | null]> {
  const out: Array<readonly [string, string | null]> = [];
  for (let i = 0; i < ordered.length; i += 2) {
    const a = ordered[i].id;
    const b = ordered[i + 1]?.id ?? null;
    out.push([a, b] as const);
  }
  return out;
}

// -------------------- public API --------------------

/**
 * Seed `teams` using the named `method`. `prngSeed` is optional and only
 * affects `random`; pass a stable value (e.g. tournament.created_at as
 * epoch ms) when reproducibility matters.
 *
 * For `sectional`: `sectionSize` defaults to 4. Sections are labelled
 * "A", "B", "C", … in entry order. Teams over the last section's capacity
 * spill into the final section.
 */
export function seedEntries(input: {
  method: SeedingMethod;
  teams: SeedingTeam[];
  prngSeed?: number;
  sectionSize?: number;
}): SeedingResult {
  const { method, teams, prngSeed, sectionSize = 4 } = input;

  if (!Array.isArray(teams)) {
    throw new Error("seeding: teams must be an array");
  }
  if (teams.length === 0) {
    return { ordered: [], pairings: method === "sectional" ? null : [] };
  }
  assertUniqueIds(teams);

  if (method === "random") {
    const rng = mulberry32(prngSeed ?? 1);
    const shuffled = shuffle(teams, rng);
    const ordered = shuffled.map((t, i) => ({ id: t.id, seed: i + 1, section_label: null }));
    return { ordered, pairings: pairAdjacent(ordered) };
  }

  if (method === "seeded") {
    // Stable sort by seed asc. Teams without a seed value sort last;
    // among themselves they keep insertion order.
    const indexed = teams.map((t, i) => ({ t, i }));
    indexed.sort((x, y) => {
      const sx = x.t.seed ?? Number.POSITIVE_INFINITY;
      const sy = y.t.seed ?? Number.POSITIVE_INFINITY;
      if (sx !== sy) return sx - sy;
      return x.i - y.i;
    });
    const sortedTeams = indexed.map(({ t }) => t);

    // Standard 1-vs-N pairing: pair[i] = (seed_i, seed_(N-1-i)).
    const ordered: { id: string; seed: number; section_label: string | null }[] = [];
    const N = sortedTeams.length;
    for (let i = 0; i < Math.ceil(N / 2); i++) {
      ordered.push({ id: sortedTeams[i].id, seed: i + 1, section_label: null });
      const partner = sortedTeams[N - 1 - i];
      if (partner && partner.id !== sortedTeams[i].id) {
        ordered.push({ id: partner.id, seed: N - i, section_label: null });
      }
    }

    return { ordered, pairings: pairAdjacent(ordered) };
  }

  if (method === "sectional") {
    if (!Number.isInteger(sectionSize) || sectionSize < 2) {
      throw new Error("seeding: sectional requires sectionSize >= 2");
    }
    const ordered = teams.map((t, i) => ({
      id: t.id,
      seed: i + 1,
      section_label: sectionLabel(Math.floor(i / sectionSize)),
    }));
    // Round-robin pairings come from a different generator (Phase 7+);
    // signal that with `pairings: null`.
    return { ordered, pairings: null };
  }

  throw new Error(`seeding: unknown method "${String(method)}"`);
}

/** "A" .. "Z", "AA" .. "ZZ" — Excel-column style labelling. */
function sectionLabel(index: number): string {
  const letters: string[] = [];
  let n = index;
  do {
    letters.unshift(String.fromCharCode(65 + (n % 26)));
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters.join("");
}
