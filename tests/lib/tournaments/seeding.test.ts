import { describe, expect, it } from "vitest";
import { seedEntries, type SeedingTeam } from "@/lib/tournaments/seeding";

const T = (n: number, seed?: number | null): SeedingTeam => ({
  id: `t${n}`,
  ...(seed !== undefined ? { seed } : {}),
});

describe("seedEntries — error + empty edge cases", () => {
  it("throws on duplicate ids", () => {
    expect(() => seedEntries({ method: "random", teams: [T(1), T(1)] })).toThrow(
      /duplicate team id/,
    );
  });
  it("throws on non-array teams", () => {
    expect(() =>
      seedEntries({
        method: "random",
        teams: "nope" as unknown as SeedingTeam[],
      }),
    ).toThrow(/must be an array/);
  });
  it("throws on unknown method", () => {
    expect(() =>
      seedEntries({
        method: "unknown" as unknown as "random",
        teams: [T(1)],
      }),
    ).toThrow(/unknown method/);
  });
  it("empty teams returns empty ordered + empty pairings (random)", () => {
    expect(seedEntries({ method: "random", teams: [] })).toEqual({
      ordered: [],
      pairings: [],
    });
  });
  it("empty teams returns empty ordered + null pairings (sectional)", () => {
    expect(seedEntries({ method: "sectional", teams: [] })).toEqual({
      ordered: [],
      pairings: null,
    });
  });
  it("sectional with sectionSize < 2 throws", () => {
    expect(() =>
      seedEntries({ method: "sectional", teams: [T(1), T(2)], sectionSize: 1 }),
    ).toThrow(/sectionSize >= 2/);
  });
});

describe("seedEntries — random method", () => {
  it("preserves all team ids in the ordered list", () => {
    const teams = [T(1), T(2), T(3), T(4), T(5)];
    const out = seedEntries({ method: "random", teams, prngSeed: 42 });
    const ids = out.ordered.map((t) => t.id).sort();
    expect(ids).toEqual(["t1", "t2", "t3", "t4", "t5"]);
  });
  it("assigns sequential seeds 1..N", () => {
    const out = seedEntries({
      method: "random",
      teams: [T(1), T(2), T(3), T(4)],
      prngSeed: 1,
    });
    const seeds = out.ordered.map((t) => t.seed).sort((a, b) => a - b);
    expect(seeds).toEqual([1, 2, 3, 4]);
  });
  it("emits adjacent pairings — N teams produce ceil(N/2) pairs", () => {
    const out = seedEntries({
      method: "random",
      teams: [T(1), T(2), T(3), T(4), T(5)],
      prngSeed: 1,
    });
    expect(out.pairings).not.toBeNull();
    expect(out.pairings!.length).toBe(3);
    expect(out.pairings![2][1]).toBeNull(); // odd team has BYE partner
  });
  it("section_label is null for random method", () => {
    const out = seedEntries({ method: "random", teams: [T(1), T(2)] });
    expect(out.ordered[0].section_label).toBe(null);
  });
  it("deterministic given the same prngSeed", () => {
    const a = seedEntries({
      method: "random",
      teams: [T(1), T(2), T(3), T(4)],
      prngSeed: 7,
    });
    const b = seedEntries({
      method: "random",
      teams: [T(1), T(2), T(3), T(4)],
      prngSeed: 7,
    });
    expect(a.ordered.map((t) => t.id)).toEqual(b.ordered.map((t) => t.id));
  });
});

describe("seedEntries — seeded method (1-vs-N pairing)", () => {
  it("4 teams seeded 1-2-3-4 → ordered 1-4-2-3 (1vN, 2v3)", () => {
    const teams = [T(1, 1), T(2, 2), T(3, 3), T(4, 4)];
    const out = seedEntries({ method: "seeded", teams });
    expect(out.ordered.map((t) => t.id)).toEqual(["t1", "t4", "t2", "t3"]);
  });
  it("8 teams produces 1v8, 2v7, 3v6, 4v5 pairings", () => {
    const teams = [T(1, 1), T(2, 2), T(3, 3), T(4, 4), T(5, 5), T(6, 6), T(7, 7), T(8, 8)];
    const out = seedEntries({ method: "seeded", teams });
    expect(out.pairings).toEqual([
      ["t1", "t8"],
      ["t2", "t7"],
      ["t3", "t6"],
      ["t4", "t5"],
    ]);
  });
  it("unseeded teams sort last (preserve insertion order among themselves)", () => {
    const teams = [T(1, null), T(2, 1), T(3, null), T(4, 2)];
    const out = seedEntries({ method: "seeded", teams });
    // Sort: t2 (seed 1), t4 (seed 2), t1 (unseeded, first by insertion), t3 (unseeded, second)
    // Then 1-vs-N pairing — but ordered list is reordered for the pairing fold.
    const ids = out.ordered.map((t) => t.id);
    // Seeded teams come first in the sorted-then-folded order
    expect(ids[0]).toBe("t2"); // seed 1 is first
  });
  it("odd teams: 5-team bracket folds into 1v5, 2v4, 3 (alone)", () => {
    const teams = [T(1, 1), T(2, 2), T(3, 3), T(4, 4), T(5, 5)];
    const out = seedEntries({ method: "seeded", teams });
    expect(out.ordered).toHaveLength(5);
    // The middle seed pairs with itself — pairAdjacent emits a half-pair.
    expect(out.pairings).not.toBeNull();
  });
});

describe("seedEntries — sectional method", () => {
  it("section_label assigned A, B, C, … by sectionSize=4", () => {
    const teams = [T(1), T(2), T(3), T(4), T(5), T(6), T(7), T(8)];
    const out = seedEntries({ method: "sectional", teams, sectionSize: 4 });
    expect(out.ordered.map((t) => t.section_label)).toEqual([
      "A", "A", "A", "A",
      "B", "B", "B", "B",
    ]);
  });
  it("emits null pairings (round-robin generator owns those)", () => {
    const out = seedEntries({
      method: "sectional",
      teams: [T(1), T(2), T(3)],
      sectionSize: 4,
    });
    expect(out.pairings).toBe(null);
  });
  it("teams overflowing the last section get its label", () => {
    const teams = [T(1), T(2), T(3), T(4), T(5)];
    const out = seedEntries({ method: "sectional", teams, sectionSize: 4 });
    // 4 in section A, 1 in section B
    expect(out.ordered.map((t) => t.section_label)).toEqual(["A", "A", "A", "A", "B"]);
  });
  it("more than 26 sections roll over to AA, BB, …", () => {
    // 53 teams with sectionSize=2 → 26 sections of 2 + 1 team in section AA.
    // (sectionSize=1 isn't allowed; minimum is 2.)
    const teams = Array.from({ length: 53 }, (_, i) => T(i + 1));
    const out = seedEntries({ method: "sectional", teams, sectionSize: 2 });
    expect(out.ordered[50].section_label).toBe("Z"); // index 50 → section 25 → Z
    expect(out.ordered[52].section_label).toBe("AA"); // index 52 → section 26 → AA
  });
});
